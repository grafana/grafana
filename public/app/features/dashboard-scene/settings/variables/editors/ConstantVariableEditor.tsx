import React from 'react';

import { ConstantVariable } from '@grafana/scenes';

interface ConstantVariableEditorProps {
  variable: ConstantVariable;
  onChange: (variable: ConstantVariable) => void;
}

export function ConstantVariableEditor(props: ConstantVariableEditorProps) {
  return <div>ConstantVariableEditor</div>;
}
