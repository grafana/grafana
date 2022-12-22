import React, { useState } from 'react';

import { InlineField, Input, Select } from '@grafana/ui';

import { GraphiteQuery, GraphiteQueryType } from '../types';

import { convertToGraphiteQueryObject } from './helpers';

interface Props {
  query: GraphiteQuery | string;
  onChange: (query: GraphiteQuery) => void;
}

const GRAPHITE_QUERY_VARIABLE_TYPE_OPTIONS = [
  { label: 'Default Query', value: GraphiteQueryType.Default },
  { label: 'Value Query', value: GraphiteQueryType.Value },
  { label: 'Metric Name Query', value: GraphiteQueryType.MetricName },
];

export const GraphiteVariableEditor = (props: Props) => {
  const { query, onChange } = props;
  const [value, setValue] = useState(convertToGraphiteQueryObject(query));

  return (
    <>
      <InlineField label="Select query type" labelWidth={20}>
        <Select
          aria-label="select query type"
          options={GRAPHITE_QUERY_VARIABLE_TYPE_OPTIONS}
          width={25}
          value={value.queryType ?? GraphiteQueryType.Default}
          onChange={(selectableValue) => {
            setValue({
              ...value,
              queryType: selectableValue.value,
            });

            if (value.target) {
              onChange({
                ...value,
                queryType: selectableValue.value,
              });
            }
          }}
        />
      </InlineField>
      <InlineField label="Query" labelWidth={20} grow>
        <Input
          aria-label="Variable editor query input"
          value={value.target}
          onBlur={() => onChange(value)}
          onChange={(e) => {
            setValue({
              ...value,
              target: e.currentTarget.value,
            });
          }}
        />
      </InlineField>
    </>
  );
};
