import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { RadioButtonGroup } from '@grafana/ui';

import { QueryEditorMode } from './types';

export interface Props {
  mode: QueryEditorMode;
  onChange: (mode: QueryEditorMode) => void;
}

const editorModes = [
  { label: 'Builder', value: QueryEditorMode.Builder },
  { label: 'Code', value: QueryEditorMode.Code },
];

export function QueryEditorModeToggle({ mode, onChange }: Props) {
  return (
    <div data-testid={selectors.components.DataSource.Prometheus.queryEditor.editorToggle}>
      <RadioButtonGroup options={editorModes} size="sm" value={mode} onChange={onChange} />
    </div>
  );
}
