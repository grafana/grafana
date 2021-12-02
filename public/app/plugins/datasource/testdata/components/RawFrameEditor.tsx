import React from 'react';
import { InlineField, TextArea } from '@grafana/ui';
import { EditorProps } from '../QueryEditor';

export const RawFrameEditor = ({ onChange, query }: EditorProps) => {
  const onContent = (rawFrameContent: string) => {
    onChange({ ...query, rawFrameContent });
  };

  return (
    <InlineField label="Frames" labelWidth={14}>
      <TextArea
        width="100%"
        rows={10}
        onBlur={(e) => onContent(e.currentTarget.value)}
        placeholder="frames array (JSON)"
        defaultValue={query.rawFrameContent ?? '[]'}
      />
    </InlineField>
  );
};
