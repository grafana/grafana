import { css } from '@emotion/css';
import { FormEvent, useId, useMemo, useRef, useState } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { LocalValueVariable, MultiValueVariable, SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Input, TextArea, Button, Field, Box, Stack, LinkButton, TextLink, Label, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions, undoRedoWasClicked } from '../../edit-pane/shared';
import { useEditPaneInputAutoFocus } from '../../scene/layouts-shared/utils';
import { BulkActionElement } from '../../scene/types/BulkActionElement';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { VariableHideSelect } from '../../settings/variables/components/VariableHideSelect';
import { getEditableVariableDefinition, validateVariableName } from '../../settings/variables/utils';

import { useVariableSelectionOptionsCategory } from './useVariableSelectionOptionsCategory';

// TODO fix conditional hook usage here...
function useEditPaneOptions(this: VariableEditableElement, isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
  const variable = this.variable;
  const variableOptionsCategoryId = useId();
  const variableNameId = useId();
  const labelId = useId();
  const descriptionId = useId();
  const variableHideId = useId();

  if (variable instanceof LocalValueVariable) {
    return useLocalVariableOptions(variable);
  }

  const basicOptions = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: variableOptionsCategoryId })
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: variableNameId,
          skipField: true,
          render: () => <VariableNameInput variable={variable} isNewElement={isNewElement} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: labelId,
          skipField: true,
          render: () => <VariableLabelInput variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: descriptionId,
          skipField: true,
          render: () => <VariableDescriptionTextArea variable={variable} />,
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: variableHideId,
          skipField: true,
          render: () => <VariableHideInput variable={variable} />,
        })
      );
  }, [variableOptionsCategoryId, variableNameId, labelId, descriptionId, variableHideId, variable, isNewElement]);

  const categories = [basicOptions];
  const typeCategory = useVariableTypeCategory(variable);
  categories.push(typeCategory);

  if (variable instanceof MultiValueVariable) {
    categories.push(useVariableSelectionOptionsCategory(variable));
  }

  return categories;
}

export class VariableEditableElement implements EditableDashboardElement, BulkActionElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(public variable: SceneVariable) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    if (this.variable instanceof LocalValueVariable) {
      return {
        typeName: t('dashboard.edit-pane.elements.local-variable', 'Local variable'),
        icon: 'dollar-alt',
        instanceName: this.variable.state.name,
        isHidden: true,
      };
    }

    const variableEditorDef = getEditableVariableDefinition(this.variable.state.type);

    return {
      typeName: t('dashboard.edit-pane.elements.variable', '{{type}} variable', { type: variableEditorDef.name }),
      icon: 'dollar-alt',
      instanceName: this.variable.state.name,
      isHidden: this.variable.state.hide === VariableHide.hideVariable,
    };
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this);

  public onDelete() {
    const set = this.variable.parent!;
    if (set instanceof SceneVariableSet) {
      dashboardEditActions.removeVariable({
        source: set,
        removedObject: this.variable,
      });
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
  id?: string;
}

function VariableNameInput({ variable, isNewElement }: { variable: SceneVariable; isNewElement: boolean }) {
  const { name } = variable.useState();
  const ref = useEditPaneInputAutoFocus({ autoFocus: isNewElement });
  const [nameError, setNameError] = useState<string>();
  const id = useId();

  const onChange = (e: FormEvent<HTMLInputElement>) => {
    const result = validateVariableName(variable, e.currentTarget.value);
    if (result.errorMessage !== nameError) {
      setNameError(result.errorMessage);
    }

    variable.setState({ name: e.currentTarget.value });
  };

  const oldName = useRef(name);

  return (
    <Field label={t('dashboard.edit-pane.variable.name', 'Name')} invalid={!!nameError} error={nameError}>
      <Input
        id={id}
        ref={ref}
        value={name}
        onFocus={() => {
          oldName.current = name;
        }}
        onChange={onChange}
        onBlur={(e) => {
          const labelUnchanged = oldName.current === name;
          const shouldSkip = labelUnchanged || undoRedoWasClicked(e);

          if (nameError) {
            setNameError(undefined);
            variable.setState({ name: oldName.current });
            return;
          }

          if (shouldSkip) {
            return;
          }

          dashboardEditActions.changeVariableName({
            source: variable,
            oldValue: oldName.current,
            newValue: name,
          });
        }}
        data-testid={selectors.components.PanelEditor.ElementEditPane.variableNameInput}
        required
      />
    </Field>
  );
}

function VariableLabelInput({ variable, id }: VariableInputProps) {
  const { label } = variable.useState();
  const oldLabel = useRef(label ?? '');

  return (
    <UnsetField value={label} label={t('dashboard.edit-pane.variable.label', 'Display name')}>
      {(onValueChanged, autoFocus) => (
        <Input
          id={id}
          value={label}
          onFocus={() => {
            oldLabel.current = label ?? '';
          }}
          autoFocus={autoFocus}
          onChange={(e) => variable.setState({ label: e.currentTarget.value })}
          onBlur={(e) => {
            const labelUnchanged = oldLabel.current === e.currentTarget.value;
            const shouldSkip = labelUnchanged || undoRedoWasClicked(e);

            onValueChanged(e.currentTarget.value);

            if (shouldSkip) {
              return;
            }

            dashboardEditActions.changeVariableLabel({
              source: variable,
              oldValue: oldLabel.current,
              newValue: e.currentTarget.value,
            });
          }}
          data-testid={selectors.components.PanelEditor.ElementEditPane.variableLabelInput}
        />
      )}
    </UnsetField>
  );
}

function VariableDescriptionTextArea({ variable, id }: VariableInputProps) {
  const { description } = variable.useState();
  const oldDescription = useRef(description ?? '');

  return (
    <UnsetField value={description} label={t('dashboard.edit-pane.variable.description', 'Description')}>
      {(onValueChanged, autoFocus) => (
        <TextArea
          id={id}
          value={description ?? ''}
          placeholder={t('dashboard.edit-pane.variable.description-placeholder', 'Descriptive text')}
          onFocus={() => {
            oldDescription.current = description ?? '';
          }}
          autoFocus={autoFocus}
          onChange={(e) => variable.setState({ description: e.currentTarget.value })}
          onBlur={(e) => {
            const labelUnchanged = oldDescription.current === e.currentTarget.value;
            const shouldSkip = labelUnchanged || undoRedoWasClicked(e);

            onValueChanged(e.currentTarget.value);

            if (shouldSkip) {
              return;
            }

            dashboardEditActions.changeVariableDescription({
              source: variable,
              oldValue: oldDescription.current,
              newValue: e.currentTarget.value,
            });
          }}
        />
      )}
    </UnsetField>
  );
}

export interface UnsetFieldProps<T> {
  value: T;
  defaultValue?: T;
  label: string;
  description?: string;
  children: (onValueChanged: (value: T) => void, autoFocus: boolean) => React.ReactElement;
}

function UnsetField<T>({ value, defaultValue, children, label }: UnsetFieldProps<T>) {
  const styles = useStyles2(getUnsetFieldStyles);
  const [isSetting, setIsSetting] = useToggle(false);

  if (isDefault(value, defaultValue) && !isSetting) {
    return (
      <div className={styles.wrapper}>
        <Label>{label}</Label>
        <div className={styles.button}>
          <Button size="sm" fill="text" icon="plus" onClick={setIsSetting}>
            <Trans i18nKey="dashboard.edit-pane.set-option-button">Set</Trans>
          </Button>
        </div>
      </div>
    );
  }

  const onValueChanged = (newValue: T | null | undefined) => {
    if (isDefault(newValue, defaultValue)) {
      setIsSetting();
    }
  };

  return <Field label={label}>{children(onValueChanged, isDefault(value, defaultValue))}</Field>;
}

function isDefault<T>(value: T | null | undefined, defaultValue: T | null | undefined) {
  if (defaultValue == null && (value == null || value === '')) {
    return true;
  }

  return defaultValue === value;
}

export function getUnsetFieldStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      label: {
        color: theme.colors.text.secondary,
        marginBottom: 0,
      },
      position: 'relative',
    }),
    button: css({
      position: 'absolute',
      right: theme.spacing(0),
    }),
  };
}

function VariableHideInput({ variable }: VariableInputProps) {
  const { hide = VariableHide.dontHide } = variable.useState();

  const onChange = (option: VariableHide, onValueChanged: (value: VariableHide) => void) => {
    onValueChanged(option);
    dashboardEditActions.changeVariableHideValue({
      source: variable,
      oldValue: hide,
      newValue: option,
    });
  };

  return (
    <UnsetField
      value={hide}
      defaultValue={VariableHide.dontHide}
      label={t('dashboard-scene.variable-show-select.label', 'Show in')}
    >
      {(onValueChanged) => (
        <VariableHideSelect
          hide={hide}
          type={variable.state.type}
          onChange={(v) => onChange(v, onValueChanged)}
          autoFocus={true}
        />
      )}
    </UnsetField>
  );
}

function useVariableTypeCategory(variable: SceneVariable) {
  const oldVariableId = useId();
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
          id: oldVariableId,
          skipField: true,
          render: () => <OpenOldVariableEditButton variable={variable} />,
        })
      );
    }

    return category;
  }, [oldVariableId, variable]);
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

function useLocalVariableOptions(variable: LocalValueVariable): OptionsPaneCategoryDescriptor[] {
  const localVariableOptionsCategoryId = useId();
  const localVariableId = useId();
  return useMemo(() => {
    const category = new OptionsPaneCategoryDescriptor({
      title: '',
      id: localVariableOptionsCategoryId,
    });

    category.addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: localVariableId,
        skipField: true,
        render: () => {
          return (
            <Box paddingBottom={1}>
              <Stack>
                <Stack>
                  <span>${variable.state.name}</span>
                  <span>=</span>
                  <span>{variable.getValueText()}</span>
                </Stack>
              </Stack>
            </Box>
          );
        },
      })
    );

    return [category];
  }, [localVariableId, localVariableOptionsCategoryId, variable]);
}
