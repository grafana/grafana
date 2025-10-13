import { Input, InlineFieldRow, InlineField, Select } from '@grafana/ui';

import { NodesQuery, TestDataDataQuery } from '../dataquery';

export interface Props {
  onChange: (value: NodesQuery) => void;
  query: TestDataDataQuery;
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
      {(type === 'random' || type === 'random edges') && (
        <>
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
          <InlineField label="Seed" labelWidth={14}>
            <Input
              type="number"
              name="seed"
              value={query.nodes?.seed}
              width={16}
              onChange={(e) =>
                onChange({ ...query.nodes, seed: e.currentTarget.value ? parseInt(e.currentTarget.value, 10) : 0 })
              }
            />
          </InlineField>
        </>
      )}
    </InlineFieldRow>
  );
}

const options: Array<NodesQuery['type']> = [
  'random',
  'response_small',
  'response_medium',
  'random edges',
  'feature_showcase',
];
