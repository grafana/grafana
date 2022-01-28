import React, { useState } from 'react';
import { Alert, CodeEditor } from '@grafana/ui';
import { EditorProps } from '../QueryEditor';
import { isArray } from 'lodash';
import { toDataQueryResponse } from '@grafana/runtime';

export const RawFrameEditor = ({ onChange, query }: EditorProps) => {
  const [error, setError] = useState<string>();
  const [warning, setWarning] = useState<string>();

  // const onContent = (rawFrameContent: string) => {
  //   onChange({ ...query, rawFrameContent });
  // };

  // return (
  //   <InlineField label="Frames" labelWidth={14}>
  //     <TextArea
  //       width="100%"
  //       rows={10}
  //       onBlur={(e) => onContent(e.currentTarget.value)}
  //       placeholder="frames array (JSON)"
  //       defaultValue={query.rawFrameContent ?? '[]'}
  //     />
  //   </InlineField>
  // );

  const onSaveFrames = (rawFrameContent: string) => {
    try {
      const json = JSON.parse(rawFrameContent);
      if (isArray(json)) {
        onChange({ ...query, rawFrameContent });
        setError(undefined);
        setWarning(undefined);
        return;
      }

      // Chek if it is a copy of the raw resuls
      const v = toDataQueryResponse({ data: json });
      if (v.data?.length && !v.error) {
        onChange({ ...query, rawFrameContent: JSON.stringify(v.data, null, 2) });
        setError(undefined);
        setWarning('Converted to direct frame result');
        return;
      }

      setError('Must be array of data frames');
    } catch (e) {
      setError('Unable to parse JSON body');
      setWarning(undefined);
    }
  };

  return (
    <>
      {error && <Alert title={error} severity="error" />}
      {warning && <Alert title={warning} severity="warning" />}
      <CodeEditor
        height={300}
        language="json"
        value={query.rawFrameContent ?? '[]'}
        onBlur={onSaveFrames}
        onSave={onSaveFrames}
        showMiniMap={false}
        showLineNumbers={true}
      />
    </>
  );
};
