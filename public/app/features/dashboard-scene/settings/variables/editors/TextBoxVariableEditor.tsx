import React from 'react';

import { TextBoxVariable } from '@grafana/scenes';

interface TextBoxVariableEditorProps {
  variable: TextBoxVariable;
  onChange: (variable: TextBoxVariable) => void;
}

export function TextBoxVariableEditor(props: TextBoxVariableEditorProps) {
  return <div>TextBoxVariableEditor</div>;
}
