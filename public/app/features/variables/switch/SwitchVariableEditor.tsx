import { memo } from 'react';

import { SwitchVariableModel } from '@grafana/data';
import { SwitchVariableForm } from 'app/features/dashboard-scene/settings/variables/components/SwitchVariableForm';

import { VariableEditorProps } from '../editor/types';

export interface Props extends VariableEditorProps<SwitchVariableModel> {}

export const SwitchVariableEditor = memo(({ onPropChange, variable }: Props) => {
  const onEnabledValueChange = (newEnabledValue: string) => {
    const shouldUpdateCurrent = variable.current.value === variable.options[0].value;

    const enabled = {
      ...variable.options[0],
      value: newEnabledValue,
      text: newEnabledValue,
    };

    const disabled = variable.options[1];

    onPropChange({
      propName: 'options',
      propValue: [enabled, disabled],
      updateOptions: true,
    });

    if (shouldUpdateCurrent) {
      onPropChange({
        propName: 'current',
        propValue: enabled,
      });
    }
  };

  const onDisabledValueChange = (newDisabledValue: string) => {
    const shouldUpdateCurrent = variable.current.value === variable.options[1].value;

    const enabled = variable.options[0];

    const disabled = {
      ...variable.options[1],
      value: newDisabledValue,
      text: newDisabledValue,
    };

    onPropChange({
      propName: 'options',
      propValue: [enabled, disabled],
      updateOptions: true,
    });

    if (shouldUpdateCurrent) {
      onPropChange({
        propName: 'current',
        propValue: disabled,
      });
    }
  };

  return (
    <SwitchVariableForm
      enabledValue={String(variable.options[0].value)}
      disabledValue={String(variable.options[1].value)}
      onEnabledValueChange={onEnabledValueChange}
      onDisabledValueChange={onDisabledValueChange}
    />
  );
});

SwitchVariableEditor.displayName = 'SwitchVariableEditor';
