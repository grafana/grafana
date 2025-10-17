import { SceneVariable, SwitchVariable } from '@grafana/scenes';

import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { SwitchVariableForm } from '../components/SwitchVariableForm';

interface SwitchVariableEditorProps {
  variable: SwitchVariable;
}

export function SwitchVariableEditor({ variable }: SwitchVariableEditorProps) {
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

  return (
    <SwitchVariableForm
      enabledValue={enabledValue}
      disabledValue={disabledValue}
      onEnabledValueChange={onEnabledValueChange}
      onDisabledValueChange={onDisabledValueChange}
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
      render: () => <SwitchVariableEditor variable={variable} />,
    }),
  ];
}
