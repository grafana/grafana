import React from 'react';

import { QueryVariable } from '@grafana/scenes';

interface QueryVariableEditorProps {
  variable: QueryVariable;
  onChange: (variable: QueryVariable) => void;
}

export function QueryVariableEditor(props: QueryVariableEditorProps) {
  return <div>QueryVariableEditor</div>;
}
