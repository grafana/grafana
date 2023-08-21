import React, { useEffect, useState } from 'react';

import { DataQuery, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { TempoDatasource } from './datasource';

export enum TempoVariableQueryType {
  LabelNames,
  LabelValues,
}

export interface TempoVariableQuery extends DataQuery {
  type: TempoVariableQueryType;
  label?: string;
  stream?: string;
}

const variableOptions = [
  { label: 'Label names', value: TempoVariableQueryType.LabelNames },
  { label: 'Label values', value: TempoVariableQueryType.LabelValues },
];

const refId = 'TempoDatasourceVariableQueryEditor-VariableQuery';

export type TempoVariableQueryEditorProps = {
  onChange: (value: TempoVariableQuery) => void;
  query: TempoVariableQuery;
  datasource: TempoDatasource;
};

export const TempoVariableQueryEditor = ({ onChange, query, datasource }: TempoVariableQueryEditorProps) => {
  const [label, setLabel] = useState(query.label || '');
  const [type, setType] = useState<number | undefined>(query.type);
  const [labelOptions, setLabelOptions] = useState<Array<SelectableValue<string>>>([]);

  useEffect(() => {
    if (type === TempoVariableQueryType.LabelValues) {
      datasource.labelNamesQuery().then((labelNames: Array<{ text: string }>) => {
        setLabelOptions(labelNames.map(({ text }) => ({ label: text, value: text })));
      });
    }
  }, [datasource, query, type]);

  const onQueryTypeChange = (newType: SelectableValue<TempoVariableQueryType>) => {
    setType(newType.value);
    if (newType.value !== undefined) {
      onChange({
        type: newType.value,
        label,
        refId,
      });
    }
  };

  const onLabelChange = (newLabel: SelectableValue<string>) => {
    const newLabelValue = newLabel.value || '';
    setLabel(newLabelValue);
    if (type !== undefined) {
      onChange({
        type,
        label: newLabelValue,
        stream: undefined,
        refId,
      });
    }
  };

  const handleBlur = () => {
    if (type !== undefined) {
      onChange({ type, label, stream: undefined, refId });
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
      {type === TempoVariableQueryType.LabelValues && (
        <InlineField label="Label" labelWidth={20}>
          <Select
            aria-label="Label"
            onChange={onLabelChange}
            onBlur={handleBlur}
            value={{ label, value: label }}
            options={labelOptions}
            width={16}
          />
        </InlineField>
      )}
    </InlineFieldRow>
  );
};
