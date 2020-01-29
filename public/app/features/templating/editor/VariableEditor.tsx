import React, { FunctionComponent } from 'react';

import { variableAdapters } from '../adapters';
import { VariableIdentifier } from '../state/actions';

export interface VariableEditorProps extends VariableIdentifier {}

export const VariableEditor: FunctionComponent<VariableEditorProps> = ({ uuid, type }) => {
  if (!variableAdapters.contains(type)) {
    return null;
  }

  const EditorToRender = variableAdapters.get(type).editor;
  if (!EditorToRender) {
    return null;
  }

  return <EditorToRender uuid={uuid} type={type} />;
};
