import React from 'react';
import { CodeEditor, InlineField } from '@grafana/ui';
import { EditorProps } from '../QueryEditor';

export const CSVContentEditor = ({ onChange, query }: EditorProps) => {
  const onContent = (v: string) => {
    onChange({ ...query, csvContent: v });
  };

  return (
    <InlineField label="CSV" labelWidth={14} grow>
      <CodeEditor
        language="csv"
        value={query.csvContent ?? ''}
        onBlur={onContent}
        width="100%"
        height="200px"
        showMiniMap={false}
      />
    </InlineField>
  );
};
