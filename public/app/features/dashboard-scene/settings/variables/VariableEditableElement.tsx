import { FormEvent, useMemo, useState } from 'react';

import { VariableHide } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Combobox, Input, TextArea, Stack, Button, Field } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { ObjectRemovedFromCanvasEvent } from '../../edit-pane/shared';
import { useEditPaneInputAutoFocus } from '../../scene/layouts-shared/utils';
import { BulkActionElement } from '../../scene/types/BulkActionElement';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { VariableHideSelect } from '../../settings/variables/components/VariableHideSelect';
import { getVariableTypeSelectOptions, validateVariableName } from '../../settings/variables/utils';

export class VariableEditableElement implements EditableDashboardElement, BulkActionElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(public variable: SceneVariable) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.variable', 'Variable'),
      icon: 'dollar-alt',
      instanceName: this.variable.state.name,
      isHidden: this.variable.state.hide === VariableHide.hideVariable,
    };
  }

  public useEditPaneOptions(isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
    const variable = this.variable;

    const options = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({ title: '', id: 'panel-options' })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            skipField: true,
            render: () => <VariableNameInput variable={variable} isNewElement={isNewElement} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard-scene.variable-editor-form.label', 'Label'),
            description: t(
              'dashboard-scene.variable-editor-form.description-optional-display-name',
              'Optional display name'
            ),
            render: () => <VariableLabelInput variable={variable} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard-scene.variable-editor-form.description', 'Description'),
            render: () => <VariableDescriptionTextArea variable={variable} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            skipField: true,
            render: () => <VariableHideInput variable={variable} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard-scene.variable-editor-form.type', 'Type'),
            render: () => <VariableTypeSelect variable={variable} />,
          })
        );
    }, [variable, isNewElement]);

    return [options];
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
    <Field label={t('dashboard-scene.variable-editor-form.name', 'Name')} invalid={!!nameError} error={nameError}>
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
      placeholder={t('dashboard-scene.variable-editor-form.placeholder-descriptive-text', 'Descriptive text')}
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

function VariableTypeSelect({ variable }: VariableInputProps) {
  const options = useMemo(() => getVariableTypeSelectOptions().map((o) => ({ value: o.value!, label: o.label })), []);

  const onOpenVariableEdior = () => {
    const set = variable.parent!;
    if (!(set instanceof SceneVariableSet)) {
      return;
    }

    const variableIndex = set.state.variables.indexOf(variable);
    locationService.partial({ editview: 'variables', editIndex: variableIndex });
  };

  return (
    <Stack gap={2} direction={'column'}>
      <Combobox value={variable.state.type} options={options} disabled={true} onChange={() => {}} />
      <Button
        tooltip={t(
          'dashboard-scene.variable-editor-form.open-editor-tooltip',
          'For more variable options open variable editor'
        )}
        onClick={onOpenVariableEdior}
        fullWidth
      >
        <Trans i18nKey="dashboard-scene.variable-editor-form.open-editor">Open variable editor</Trans>
      </Button>
    </Stack>
  );
}
