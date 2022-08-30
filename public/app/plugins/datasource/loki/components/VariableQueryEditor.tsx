import React, { FC, FormEvent, useState, useEffect } from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

import { LokiDatasource } from '../datasource';
import { migrateVariableQuery } from '../migrations/variableQueryMigrations';
import { LokiOptions, LokiQuery, LokiVariableQuery, LokiVariableQueryType as QueryType } from '../types';

const variableOptions = [
  { label: 'Label names', value: QueryType.LabelNames },
  { label: 'Label values', value: QueryType.LabelValues },
];

export type Props = QueryEditorProps<LokiDatasource, LokiQuery, LokiOptions, LokiVariableQuery>;

export const LokiVariableQueryEditor: FC<Props> = ({ onChange, query }) => {
  const [type, setType] = useState<number | undefined>(undefined);
  const [label, setLabel] = useState('');
  const [stream, setStream] = useState('');

  useEffect(() => {
    if (!query || typeof query !== 'string') {
      return;
    }

    const variableQuery = migrateVariableQuery(query);
    setType(variableQuery.type);
    setLabel(variableQuery.label || '');
    setStream(variableQuery.stream || '');
  }, [query]);

  const onQueryTypeChange = (newType: SelectableValue<QueryType>) => {
    setType(newType.value);
    if (newType.value !== undefined) {
      onChange({
        type: newType.value,
        label,
        stream,
        refId: 'LokiVariableQueryEditor-VariableQuery',
      });
    }
  };

  const onLabelChange = (e: FormEvent<HTMLInputElement>) => {
    setLabel(e.currentTarget.value);
  };

  const onStreamChange = (e: FormEvent<HTMLInputElement>) => {
    setStream(e.currentTarget.value);
  };

  const handleBlur = () => {
    if (type !== undefined) {
      onChange({ type, label, stream, refId: 'LokiVariableQueryEditor-VariableQuery' });
    }
  };

  return (
    <InlineFieldRow>
      <InlineField label="Query type" labelWidth={20}>
        <Select
          aria-label="Query type"
          onChange={onQueryTypeChange}
          onBlur={handleBlur}
          value={type}
          options={variableOptions}
          width={16}
        />
      </InlineField>
      {type === QueryType.LabelValues && (
        <>
          <InlineField label="Label" labelWidth={20}>
            <Input type="text" aria-label="Label" value={label} onChange={onLabelChange} onBlur={handleBlur} />
          </InlineField>
          <InlineField label="Stream selector" labelWidth={20}>
            <Input
              type="text"
              aria-label="Stream selector"
              value={stream}
              onChange={onStreamChange}
              onBlur={handleBlur}
            />
          </InlineField>
        </>
      )}
    </InlineFieldRow>
  );
};
