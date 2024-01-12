import React from 'react';

import { AdHocFiltersVariable } from '@grafana/scenes';

interface AdHocFiltersVariableEditorProps {
  variable: AdHocFiltersVariable;
  onChange: (variable: AdHocFiltersVariable) => void;
}

export function AdHocFiltersVariableEditor(props: AdHocFiltersVariableEditorProps) {
  return <div>AdHocFiltersVariableEditor</div>;
}
