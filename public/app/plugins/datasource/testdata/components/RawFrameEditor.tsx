import { isArray } from 'lodash';
import React, { useState } from 'react';

import { dataFrameToJSON, toDataFrame, toDataFrameDTO } from '@grafana/data';
import { toDataQueryResponse } from '@grafana/runtime';
import { Alert, CodeEditor } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';

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

      let data = undefined;

      // Copy paste from panel json
      if (isArray(json.series) && json.state) {
        data = json.series.map((v: any) => toDataFrameDTO(toDataFrame(v)));
      } else {
        // Chek if it is a copy of the raw resuls
        const v = toDataQueryResponse({ data: json });
        if (v.data?.length && !v.error) {
          data = v.data.map((f) => dataFrameToJSON(f));
        }
      }

      if (data) {
        console.log('Original', json);
        console.log('Save', data);
        setError(undefined);
        setWarning('Converted to direct frame result');
        onChange({ ...query, rawFrameContent: JSON.stringify(data, null, 2) });
        return;
      }

      setError('Unable to read dataframes in text');
    } catch (e) {
      console.log('Error parsing json', e);
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
        showMiniMap={true}
        showLineNumbers={true}
      />
    </>
  );
};
