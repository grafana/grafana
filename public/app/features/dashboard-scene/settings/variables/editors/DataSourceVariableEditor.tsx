import React from 'react';

import { DataSourceVariable } from '@grafana/scenes';

interface DataSourceVariableEditorProps {
  variable: DataSourceVariable;
  onChange: (variable: DataSourceVariable) => void;
}

export function DataSourceVariableEditor(props: DataSourceVariableEditorProps) {
  return <div>DataSourceVariableEditor</div>;
}
