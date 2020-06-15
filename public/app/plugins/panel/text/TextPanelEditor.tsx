import React, { FC, useMemo } from 'react';
import { CodeEditor } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';
import { TextOptions } from './types';

export const TextPanelEditor: FC<StandardEditorProps<string, any, TextOptions>> = ({ value, onChange, context }) => {
  const language = useMemo(() => context.options?.mode ?? 'markdown', [context]);
  return <CodeEditor value={value} onChange={onChange} language={language} width="100%" height="150px" />;
};
