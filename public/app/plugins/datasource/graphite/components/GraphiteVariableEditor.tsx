import React, { useState } from 'react';

import { InlineField, Input, Select } from '@grafana/ui';

import { GraphiteQuery, GraphiteQueryType } from '../types';

import { concatParts, convertToVariableString, getQueryPart } from './helpers';

export const VARIABLE_DELIMITER = '___';

interface Props {
  query: GraphiteQuery | string;
  onChange: (query: string) => void;
}

const GRAPHITE_QUERY_VARIABLE_TYPE_OPTIONS = [
  { label: 'Default Query', value: GraphiteQueryType.Default },
  { label: 'Value Query', value: GraphiteQueryType.Value },
  { label: 'Metric Name Query', value: GraphiteQueryType.MetricName },
];

export const GraphiteVariableEditor = (props: Props) => {
  const { query, onChange } = props;
  const [queryString, updateQueryString] = useState(convertToVariableString(query));

  return (
    <>
      <InlineField label="Select query type" labelWidth={20}>
        <Select
          aria-label="select query type"
          options={GRAPHITE_QUERY_VARIABLE_TYPE_OPTIONS}
          width={25}
          value={getQueryPart(queryString, 0) ?? GraphiteQueryType.Default}
          onChange={(selectableValue) => {
            const qs = concatParts(selectableValue.value, getQueryPart(queryString, 1));
            updateQueryString(qs);

            // if the target exists, then call onChange
            if (getQueryPart(queryString, 1)) {
              onChange(qs);
            }
          }}
        />
      </InlineField>
      <InlineField label="Query" labelWidth={20} grow>
        <Input
          aria-label="Variable editor query input"
          value={getQueryPart(queryString, 1)}
          onBlur={() => onChange(queryString)}
          onChange={(e) => {
            const qs = concatParts(getQueryPart(queryString, 0), e.currentTarget.value);
            updateQueryString(qs);
          }}
        />
      </InlineField>
    </>
  );
};
