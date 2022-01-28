import React, { useState } from 'react';
import { Alert, CodeEditor } from '@grafana/ui';
import { EditorProps } from '../QueryEditor';
import { isArray } from 'lodash';
import { toDataQueryResponse } from '@grafana/runtime';
import { dataFrameToJSON } from '@grafana/data';

export const RawFrameEditor = ({ onChange, query }: EditorProps) => {
  const [error, setError] = useState<string>();
  const [warning, setWarning] = useState<string>();

  const onSaveFrames = (rawFrameContent: string) => {
    try {
      const json = JSON.parse(rawFrameContent);
      if (isArray(json)) {
        setError(undefined);
        setWarning(undefined);
        onChange({ ...query, rawFrameContent });
        return;
      }

      // Chek if it is a copy of the raw resuls
      const v = toDataQueryResponse({ data: json });
      if (v.data?.length && !v.error) {
        const data = v.data.map((f) => dataFrameToJSON(f));
        console.log('SOURCE', json);
        console.log('SAVE', data);
        setError(undefined);
        setWarning('Converted to direct frame result');
        onChange({ ...query, rawFrameContent: JSON.stringify(data, null, 2) });
        return;
      }

      setError('Unable to read dataframes in text');
    } catch (e) {
      setError('Enter JSON array of data frames (or raw query results body)');
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
