import React, { FunctionComponent } from 'react';
import { variableAdapters } from '../adapters';
import { VariableIdentifier } from '../state/actions';

export interface VariablePickerProps extends VariableIdentifier {}

export const VariablePicker: FunctionComponent<VariablePickerProps> = ({ uuid, type }) => {
  if (!variableAdapters.contains(type)) {
    return null;
  }

  const PickerToRender = variableAdapters.get(type).picker;
  if (!PickerToRender) {
    return null;
  }

  return <PickerToRender uuid={uuid} type={type} />;
};
