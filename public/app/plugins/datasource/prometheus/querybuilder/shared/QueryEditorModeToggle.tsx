import { RadioButtonGroup } from '@grafana/ui';
import React from 'react';
import { QueryEditorMode } from './types';

export interface Props {
  mode: QueryEditorMode;
  onChange: (mode: QueryEditorMode) => void;
}

const editorModes = [
  { label: 'Explain', value: QueryEditorMode.Explain },
  { label: 'Builder', value: QueryEditorMode.Builder },
  { label: 'Code', value: QueryEditorMode.Code },
];

export function QueryEditorModeToggle({ mode, onChange }: Props) {
  return <RadioButtonGroup options={editorModes} size="sm" value={mode} onChange={onChange} />;
}
