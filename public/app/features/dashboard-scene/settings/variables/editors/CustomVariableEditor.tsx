import React from 'react';

import { CustomVariable } from '@grafana/scenes';

interface CustomVariableEditorProps {
  variable: CustomVariable;
  onChange: (variable: CustomVariable) => void;
}

export function CustomVariableEditor(props: CustomVariableEditorProps) {
  return <div>CustomVariableEditor</div>;
}
