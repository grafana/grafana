import React, { ChangeEvent } from 'react';
import { InlineField, TextArea } from '@grafana/ui';
import { EditorProps } from '../QueryEditor';

export const CSVContentEditor = ({ onChange, query }: EditorProps) => {
  const onContent = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...query, csvContent: e.currentTarget.value });
  };

  return (
    <InlineField label="CSV" labelWidth={14}>
      <TextArea
        width="100%"
        rows={10}
        onBlur={onContent}
        placeholder="CSV content"
        defaultValue={query.csvContent ?? ''}
      />
    </InlineField>
  );
};
