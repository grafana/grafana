import { css } from '@emotion/css';
import React from 'react';

import { RadioButtonGroup, Tag } from '@grafana/ui';

import { QueryEditorMode } from './types';

export type UIOptions = {
  [key in QueryEditorMode]: boolean;
};

export interface Props {
  mode: QueryEditorMode;
  onChange: (mode: QueryEditorMode) => void;
  uiOptions: UIOptions;
}

const editorModes = [
  { label: 'Explain', value: QueryEditorMode.Explain },
  {
    label: 'Builder',
    value: QueryEditorMode.Builder,
    component: () => (
      <Tag
        className={css({
          fontSize: 10,
          padding: '1px 5px',
          verticalAlign: 'text-bottom',
        })}
        name={'Beta'}
        colorIndex={1}
      />
    ),
  },
  { label: 'Code', value: QueryEditorMode.Code },
];

export function QueryEditorModeToggle({ mode, onChange, uiOptions }: Props) {
  const modes = editorModes.filter((m) => uiOptions[m.value]);
  return (
    <div data-testid={'QueryEditorModeToggle'}>
      <RadioButtonGroup options={modes} size="sm" value={mode} onChange={onChange} />
    </div>
  );
}
