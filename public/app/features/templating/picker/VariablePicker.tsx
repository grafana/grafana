import React from 'react';
import { VariableType } from '../variable';
import { variableAdapter } from '../adapters';

export interface VariableProps {
  name: string;
  type: VariableType;
}

export const VariablePicker: React.FunctionComponent<VariableProps> = ({ name, type }) => {
  if (!variableAdapter[type].useState) {
    return null;
  }

  const PickerToRender = variableAdapter[type].picker;
  if (!PickerToRender) {
    return null;
  }

  return <PickerToRender name={name} type={type} />;
};
