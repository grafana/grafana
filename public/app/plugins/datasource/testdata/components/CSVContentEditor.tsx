import React from 'react';

import { CodeEditor } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';

export const CSVContentEditor = ({ onChange, query }: EditorProps) => {
  const onSaveCSV = (csvContent: string) => {
    onChange({ ...query, csvContent });
  };

  return (
    <CodeEditor
      height={300}
      language="csv"
      value={query.csvContent ?? ''}
      onBlur={onSaveCSV}
      onSave={onSaveCSV}
      showMiniMap={false}
      showLineNumbers={true}
    />
  );
};
