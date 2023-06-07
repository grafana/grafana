import React, { useMemo } from 'react';

import { getLLMSrv } from '@grafana/runtime';
import { RadioButtonGroup } from '@grafana/ui';

import { QueryEditorMode } from './types';

export interface Props {
  mode: QueryEditorMode;
  onChange: (mode: QueryEditorMode) => void;
}

const editorModes = [
  { label: 'Builder', value: QueryEditorMode.Builder },
  { label: 'Code', value: QueryEditorMode.Code },
  { label: 'Natural Language', value: QueryEditorMode.Natural_language },
];

export function QueryEditorModeToggle({ mode, onChange }: Props) {
  const llm = getLLMSrv();
  const modes = useMemo(
    () => editorModes.filter((m) => m.value !== QueryEditorMode.Natural_language || llm !== undefined),
    [llm]
  );
  return (
    <div data-testid={'QueryEditorModeToggle'}>
      <RadioButtonGroup options={modes} size="sm" value={mode} onChange={onChange} />
    </div>
  );
}
