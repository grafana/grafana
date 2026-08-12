import { t } from '@grafana/i18n';
import { type SceneVariable, SwitchVariable } from '@grafana/scenes';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { SwitchVariableForm } from '../components/SwitchVariableForm';
import { undoableVariableEdit } from '../undoableVariableEdit';

interface SwitchVariableEditorProps {
  variable: SwitchVariable;
  inline?: boolean;
}

export function SwitchVariableEditor({ variable, inline = false }: SwitchVariableEditorProps) {
  const { value, enabledValue, disabledValue } = variable.useState();

  const onEnabledValueChange = (newEnabledValue: string) => {
    const isCurrentlyEnabled = value === enabledValue;

    if (isCurrentlyEnabled) {
      variable.setState({ enabledValue: newEnabledValue, value: newEnabledValue });
    } else {
      variable.setState({ enabledValue: newEnabledValue });
    }
  };

  const onDisabledValueChange = (newDisabledValue: string) => {
    const isCurrentlyDisabled = value === disabledValue;

    if (isCurrentlyDisabled) {
      variable.setState({ disabledValue: newDisabledValue, value: newDisabledValue });
    } else {
      variable.setState({ disabledValue: newDisabledValue });
    }
  };

  const onValuePairChange = (newEnabledValue: string, newDisabledValue: string) => {
    if (newEnabledValue === enabledValue && newDisabledValue === disabledValue) {
      return;
    }

    const prevState = { enabledValue, disabledValue, value };
    const isCurrentlyEnabled = value === enabledValue;

    undoableVariableEdit(inline, {
      description: t('dashboard.edit-actions.variable-switch-values', 'Change switch variable values'),
      source: variable,
      perform: () =>
        variable.setState({
          enabledValue: newEnabledValue,
          disabledValue: newDisabledValue,
          value: isCurrentlyEnabled ? newEnabledValue : newDisabledValue,
        }),
      undo: () => variable.setState(prevState),
    });
  };

  return (
    <SwitchVariableForm
      enabledValue={enabledValue}
      disabledValue={disabledValue}
      onEnabledValueChange={onEnabledValueChange}
      onDisabledValueChange={onDisabledValueChange}
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
