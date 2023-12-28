import debounce from 'debounce-promise';
import React from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { Select, Input, InlineFormLabel, AsyncSelect, Stack, InlineLabel } from '@grafana/ui';

import { OpenTsdbQuery } from '../types';

export interface MetricSectionProps {
  query: OpenTsdbQuery;
  onChange: (query: OpenTsdbQuery) => void;
  onRunQuery: () => void;
  suggestMetrics: (value: string) => Promise<SelectableValue[]>;
  aggregators: string[];
}

export function MetricSection({ query, onChange, onRunQuery, suggestMetrics, aggregators }: MetricSectionProps) {
  const aggregatorOptions = aggregators.map((value: string) => toOption(value));
  const metricSearch = debounce((query: string) => suggestMetrics(query), 350);

  return (
    <Stack gap={0.5} alignItems="flex-start" data-testid={testIds.section}>
      <Stack gap={0}>
        <InlineFormLabel width={8} className="query-keyword">
          Metric
        </InlineFormLabel>
        {/* metric async select: autocomplete calls opentsdb suggest API */}
        <AsyncSelect
          width={25}
          inputId="opentsdb-metric-select"
          value={query.metric ? toOption(query.metric) : undefined}
          placeholder="Metric name"
          allowCustomValue
          loadOptions={metricSearch}
          defaultOptions={[]}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, metric: value });
              onRunQuery();
            }
          }}
        />
      </Stack>
      <Stack gap={0} alignItems="flex-start">
        <InlineFormLabel width={'auto'} className="query-keyword">
          Aggregator
        </InlineFormLabel>
        <Select
          inputId="opentsdb-aggregator-select"
          value={query.aggregator ? toOption(query.aggregator) : undefined}
          options={aggregatorOptions}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, aggregator: value });
              onRunQuery();
            }
          }}
        />
      </Stack>
      <Stack gap={0}>
        <InlineFormLabel
          className="query-keyword"
          width={6}
          tooltip={<div>Use patterns like $tag_tagname to replace part of the alias for a tag value</div>}
        >
          Alias
        </InlineFormLabel>
        <Input
          data-testid={testIds.alias}
          placeholder="series alias"
          value={query.alias ?? ''}
          onChange={(e) => {
            const value = e.currentTarget.value;
            onChange({ ...query, alias: value });
          }}
          onBlur={() => onRunQuery()}
        />
      </Stack>
      <Stack gap={0} grow={1}>
        <InlineLabel> </InlineLabel>
      </Stack>
    </Stack>
  );
}

export const testIds = {
  section: 'opentsdb-metricsection',
  alias: 'metric-alias',
};
