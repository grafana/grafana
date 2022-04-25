import React from 'react';

import { Input, InlineFieldRow, InlineField, Select } from '@grafana/ui';

import { NodesQuery, TestDataQuery } from '../types';

export interface Props {
  onChange: (value: NodesQuery) => void;
  query: TestDataQuery;
}
export function NodeGraphEditor({ query, onChange }: Props) {
  const type = query.nodes?.type || 'random';
  return (
    <InlineFieldRow>
      <InlineField label="Data type" labelWidth={14}>
        <Select<NodesQuery['type']>
          options={options.map((o) => ({
            label: o,
            value: o,
          }))}
          value={options.find((item) => item === type)}
          onChange={(value) => onChange({ ...query.nodes, type: value.value! })}
          width={32}
        />
      </InlineField>
      {type === 'random' && (
        <InlineField label="Count" labelWidth={14}>
          <Input
            type="number"
            name="count"
            value={query.nodes?.count}
            width={32}
            onChange={(e) =>
              onChange({ ...query.nodes, count: e.currentTarget.value ? parseInt(e.currentTarget.value, 10) : 0 })
            }
            placeholder="10"
          />
        </InlineField>
      )}
    </InlineFieldRow>
  );
}

const options: Array<NodesQuery['type']> = ['random', 'response'];
