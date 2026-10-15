import { isEqual } from 'lodash';
import { useRef } from 'react';

import { t } from '@grafana/i18n';
import { type SceneVariable, SwitchVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { undoableVariableEdit } from '../../../actions/variable/undoableVariableEdit';
import { SwitchVariableForm } from '../components/SwitchVariableForm';

interface SwitchVariableEditorProps {
  variable: SwitchVariable;
  inline?: boolean;
}

type SwitchValues = Pick<SwitchVariable['state'], 'value' | 'enabledValue' | 'disabledValue'>;

function getSwitchValues({ state }: SwitchVariable): SwitchValues {
  return { value: state.value, enabledValue: state.enabledValue, disabledValue: state.disabledValue };
}

export function SwitchVariableEditor({ variable, inline = false }: SwitchVariableEditorProps) {
  const { value, enabledValue, disabledValue } = variable.useState();

  const getNewValues = (newEnabledValue: string, newDisabledValue: string): SwitchValues => {
    const isCurrentlyEnabled = value === enabledValue;
    const isCurrentlyDisabled = value === disabledValue;

    return {
      enabledValue: newEnabledValue,
      disabledValue: newDisabledValue,
      value: isCurrentlyEnabled ? newEnabledValue : isCurrentlyDisabled ? newDisabledValue : value,
    };
  };

  // Typing in the custom value inputs updates the state right away, the whole edit is recorded once the input loses focus
  const valuesBeforeEdit = useRef<SwitchValues | undefined>(undefined);

  const onEnabledValueChange = (newEnabledValue: string) => {
    valuesBeforeEdit.current ??= getSwitchValues(variable);
    variable.setState(getNewValues(newEnabledValue, disabledValue));
  };

  const onDisabledValueChange = (newDisabledValue: string) => {
    valuesBeforeEdit.current ??= getSwitchValues(variable);
    variable.setState(getNewValues(enabledValue, newDisabledValue));
  };

  const onCustomValueBlur = () => {
    const oldValues = valuesBeforeEdit.current;
    const newValues = getSwitchValues(variable);
    valuesBeforeEdit.current = undefined;

    if (!inline || !oldValues || isEqual(oldValues, newValues)) {
      return;
    }

    undoableVariableEdit(true, {
      meta: { actionId: 'variable.changeSwitchValues', scope: 'custom-values' },
      source: variable,
      description: t('dashboard.edit-actions.variable-switch-values', 'Change variable switch values'),
      perform: () => variable.setState(newValues),
      undo: () => variable.setState(oldValues),
    });
  };

  const onValuePairChange = (newEnabledValue: string, newDisabledValue: string) => {
    const oldValues = getSwitchValues(variable);
    const newValues = getNewValues(newEnabledValue, newDisabledValue);

    undoableVariableEdit(inline, {
      meta: { actionId: 'variable.changeSwitchValues', scope: 'value-pair' },
      source: variable,
      description: t('dashboard.edit-actions.variable-switch-values', 'Change variable switch values'),
      perform: () => variable.setState(newValues),
      undo: () => variable.setState(oldValues),
    });
  };

  return (
    <SwitchVariableForm
      enabledValue={enabledValue}
      disabledValue={disabledValue}
      onEnabledValueChange={onEnabledValueChange}
      onDisabledValueChange={onDisabledValueChange}
      onCustomValueBlur={onCustomValueBlur}
      onValuePairChange={onValuePairChange}
      inline={inline}
    />
  );
}

export function getSwitchVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof SwitchVariable)) {
    console.warn('getSwitchVariableOptions: variable is not a SwitchVariable');
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      id: `variable-${variable.state.name}-value`,
      render: () => <SwitchVariableEditor variable={variable} inline={true} />,
    }),
  ];
}
