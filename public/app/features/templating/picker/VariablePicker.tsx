import React, { FunctionComponent } from 'react';

import { VariableType } from '../variable';
import { variableAdapters } from '../adapters';

export interface VariableProps {
  name: string;
  type: VariableType;
}

export const VariablePicker: FunctionComponent<VariableProps> = ({ name, type }) => {
  if (!variableAdapters.contains(type)) {
    return null;
  }

  const PickerToRender = variableAdapters.get(type).picker;
  if (!PickerToRender) {
    return null;
  }

  return <PickerToRender name={name} type={type} />;
};
