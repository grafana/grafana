import React from 'react';

import { IntervalVariable } from '@grafana/scenes';

interface IntervalVariableEditorProps {
  variable: IntervalVariable;
  onChange: (variable: IntervalVariable) => void;
}

export function IntervalVariableEditor(props: IntervalVariableEditorProps) {
  return <div>IntervalVariableEditor</div>;
}
