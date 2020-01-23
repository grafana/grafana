import React, { FunctionComponent } from 'react';

import { variableAdapters } from '../adapters';
import { VariableProps } from '../picker/VariablePicker';

export const VariableEditor: FunctionComponent<VariableProps> = ({ name, type }) => {
  if (!variableAdapters.contains(type)) {
    return null;
  }

  const EditorToRender = variableAdapters.get(type).editor;
  if (!EditorToRender) {
    return null;
  }

  return <EditorToRender name={name} type={type} />;
};
