import React, { useCallback, useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { Select, Input, InlineFormLabel } from '@grafana/ui';

import { OpenTsdbQuery } from '../types';

export interface MetricSectionProps {
  query: OpenTsdbQuery;
  onChange: (query: OpenTsdbQuery) => void;
  onRunQuery: () => void;
  suggestMetrics: () => Promise<SelectableValue[]>;
  aggregators: string[];
}

export function MetricSection({ query, onChange, onRunQuery, suggestMetrics, aggregators }: MetricSectionProps) {
  const [state, setState] = useState<{
    metrics?: Array<SelectableValue<string>>;
    isLoading?: boolean;
  }>({});

  // We are matching words split with space
  const splitSeparator = ' ';
  const customFilterOption = useCallback((option: SelectableValue<string>, searchQuery: string) => {
    const label = option.value ?? '';

    const searchWords = searchQuery.split(splitSeparator);
    return searchWords.reduce((acc, cur) => acc && label.toLowerCase().includes(cur.toLowerCase()), true);
  }, []);

  const aggregatorOptions = aggregators.map((value: string) => toOption(value));

  return (
    <div className="gf-form-inline" data-testid={testIds.section}>
      <div className="gf-form">
        <InlineFormLabel width={8} className="query-keyword">
          Metric
        </InlineFormLabel>
        <Select
          width={25}
          inputId="opentsdb-metric-select"
          className="gf-form-input"
          value={query.metric ? toOption(query.metric) : undefined}
          placeholder="Metric name"
          allowCustomValue
          filterOption={customFilterOption}
          onOpenMenu={async () => {
            if (!state.metrics) {
              setState({ isLoading: true });
              const metrics = await suggestMetrics();
              setState({ metrics, isLoading: undefined });
            }
          }}
          isLoading={state.isLoading}
          options={state.metrics}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, metric: value });
              onRunQuery();
            }
          }}
        />
      </div>
      <div className="gf-form">
        <InlineFormLabel width={'auto'} className="query-keyword">
          Aggregator
        </InlineFormLabel>
        <Select
          inputId="opentsdb-aggregator-select"
          className="gf-form-input"
          value={query.aggregator ? toOption(query.aggregator) : undefined}
          options={aggregatorOptions}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, aggregator: value });
              onRunQuery();
            }
          }}
        />
      </div>
      <div className="gf-form max-width-20">
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
      </div>
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow"></div>
      </div>
    </div>
  );
}

export const testIds = {
  section: 'opentsdb-metricsection',
  alias: 'metric-alias',
};
