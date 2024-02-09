import React from 'react';

import { GroupByVariable } from '@grafana/scenes';

interface GroupByVariableEditorProps {
  variable: GroupByVariable;
  onChange: (variable: GroupByVariable) => void;
}

export function GroupByVariableEditor(props: GroupByVariableEditorProps) {
  return <div>GroupByVariableEditor</div>;
}
