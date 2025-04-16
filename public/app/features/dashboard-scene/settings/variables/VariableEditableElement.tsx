import { FormEvent, useMemo, useState } from 'react';

import { VariableHide } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { MultiValueVariable, SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Input, TextArea, Button, Field, Box } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ObjectRemovedFromCanvasEvent } from '../../edit-pane/shared';
import { useEditPaneInputAutoFocus } from '../../scene/layouts-shared/utils';
import { BulkActionElement } from '../../scene/types/BulkActionElement';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { VariableHideSelect } from '../../settings/variables/components/VariableHideSelect';
import { getEditableVariableDefinition, validateVariableName } from '../../settings/variables/utils';

import { useVariableSelectionOptionsCategory } from './useVariableSelectionOptionsCategory';

export class VariableEditableElement implements EditableDashboardElement, BulkActionElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(public variable: SceneVariable) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const variableEditorDef = getEditableVariableDefinition(this.variable.state.type);

    return {
      typeName: t('dashboard.edit-pane.elements.variable', '{{type}} variable', { type: variableEditorDef.name }),
      icon: 'dollar-alt',
      instanceName: this.variable.state.name,
      isHidden: this.variable.state.hide === VariableHide.hideVariable,
    };
  }

  public useEditPaneOptions(isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
    const variable = this.variable;

    const basicOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({ title: '', id: 'variable-options' })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            skipField: true,
            render: () => <VariableNameInput variable={variable} isNewElement={isNewElement} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.edit-pane.variable.label', 'Label'),
            description: t('dashboard.edit-pane.variable.label-description', 'Optional display name'),
            render: () => <VariableLabelInput variable={variable} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.edit-pane.variable.description', 'Description'),
            render: () => <VariableDescriptionTextArea variable={variable} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            skipField: true,
            render: () => <VariableHideInput variable={variable} />,
          })
        );
    }, [variable, isNewElement]);

    const categories = [basicOptions];
    const typeCategory = useVariableTypeCategory(variable);
    categories.push(typeCategory);

    if (variable instanceof MultiValueVariable) {
      categories.push(useVariableSelectionOptionsCategory(variable));
    }

    return categories;
  }

  public onDelete() {
    const set = this.variable.parent!;
    if (set instanceof SceneVariableSet) {
      this.variable.publishEvent(new ObjectRemovedFromCanvasEvent(this.variable), true);
      set.setState({ variables: set.state.variables.filter((v) => v !== this.variable) });
    }
  }

  public onChangeName(name: string) {
    this.variable.setState({ name });

    const result = validateVariableName(this.variable, name);
    if (result.errorMessage) {
      return result;
    }

    return;
  }
}

interface VariableInputProps {
  variable: SceneVariable;
}

function VariableNameInput({ variable, isNewElement }: { variable: SceneVariable; isNewElement: boolean }) {
  const { name } = variable.useState();
  const ref = useEditPaneInputAutoFocus({ autoFocus: isNewElement });
  const [nameError, setNameError] = useState<string>();
  const [validName, setValidName] = useState<string>(variable.state.name);

  const onChange = (e: FormEvent<HTMLInputElement>) => {
    const result = validateVariableName(variable, e.currentTarget.value);
    if (result.errorMessage !== nameError) {
      setNameError(result.errorMessage);
    } else {
      setValidName(variable.state.name);
    }

    variable.setState({ name: e.currentTarget.value });
  };

  // Restore valid name if bluring while invalid
  const onBlur = () => {
    if (nameError) {
      variable.setState({ name: validName });
      setNameError(undefined);
    }
  };

  return (
    <Field label={t('dashboard.edit-pane.variable.name', 'Name')} invalid={!!nameError} error={nameError}>
      <Input ref={ref} value={name} onChange={onChange} required onBlur={onBlur} />
    </Field>
  );
}

function VariableLabelInput({ variable }: VariableInputProps) {
  const { label } = variable.useState();
  return <Input value={label} onChange={(e) => variable.setState({ label: e.currentTarget.value })} />;
}

function VariableDescriptionTextArea({ variable }: VariableInputProps) {
  const { description } = variable.useState();

  return (
    <TextArea
      id="description-text-area"
      value={description ?? ''}
      placeholder={t('dashboard.edit-pane.variable.description-placeholder', 'Descriptive text')}
      onChange={(e) => variable.setState({ description: e.currentTarget.value })}
    />
  );
}

function VariableHideInput({ variable }: VariableInputProps) {
  const { hide = VariableHide.dontHide } = variable.useState();

  const onChange = (option: VariableHide) => {
    variable.setState({ hide: option });
  };

  return <VariableHideSelect hide={hide} type={variable.state.type} onChange={onChange} />;
}

function useVariableTypeCategory(variable: SceneVariable) {
  return useMemo(() => {
    const variableEditorDef = getEditableVariableDefinition(variable.state.type);
    const categoryName = t('dashboard.edit-pane.variable.type-category', '{{type}} options', {
      type: variableEditorDef.name,
    });

    const category = new OptionsPaneCategoryDescriptor({
      title: categoryName,
      id: 'variable-type',
      isOpenDefault: true,
    });

    if (variableEditorDef.getOptions) {
      const options = variableEditorDef.getOptions(variable);
      options.forEach((option) => category.addItem(option));
    } else {
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          skipField: true,
          render: () => <OpenOldVariableEditButton variable={variable} />,
        })
      );
    }

    return category;
  }, [variable]);
}

function OpenOldVariableEditButton({ variable }: VariableInputProps) {
  const onOpenVariableEdior = () => {
    const set = variable.parent!;
    if (!(set instanceof SceneVariableSet)) {
      return;
    }

    const variableIndex = set.state.variables.indexOf(variable);
    locationService.partial({ editview: 'variables', editIndex: variableIndex });
  };

  return (
    <Box display={'flex'} direction={'column'} paddingBottom={1}>
      <Button
        tooltip={t(
          'dashboard.edit-pane.variable.open-editor-tooltip',
          'For more variable options open variable editor'
        )}
        onClick={onOpenVariableEdior}
        size="sm"
        fullWidth
      >
        <Trans i18nKey="dashboard.edit-pane.variable.open-editor">Open variable editor</Trans>
      </Button>
    </Box>
  );
}
