import React, { useCallback, useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { InlineLabel, Select, Input } from '@grafana/ui';

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
    metrics?: Array<SelectableValue<any>>;
    isLoading?: boolean;
  }>({});

  // We are matching words split with space
  const splitSeparator = ' ';
  const customFilterOption = useCallback((option: SelectableValue<any>, searchQuery: string) => {
    const label = option.value;

    const searchWords = searchQuery.split(splitSeparator);
    return searchWords.reduce((acc, cur) => acc && label.toLowerCase().includes(cur.toLowerCase()), true);
  }, []);

  const aggregatorOptions = aggregators.map((value: string) => toOption(value));

  return (
    <div className="gf-form-inline" data-testid={testIds.section}>
      <div className="gf-form max-width-25">
        <InlineLabel className="width-8 query-keyword">Metric</InlineLabel>
        <Select
          inputId="opentsdb-metric-select"
          className="gf-form-input"
          value={query.metric ? toOption(query.metric) : undefined}
          placeholder="Metric name"
          allowCustomValue
          filterOption={customFilterOption}
          onOpenMenu={async () => {
            if (state.metrics && state.metrics.length === 0) {
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
            }
          }}
          onBlur={() => onRunQuery()}
        />
      </div>
      <div className="gf-form">
        <InlineLabel className="width-8 query-keyword">Aggregator</InlineLabel>
        <Select
          inputId="opentsdb-aggregator-select"
          value={query.aggregator ? toOption(query.aggregator) : undefined}
          options={aggregatorOptions}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, aggregator: value });
            }
          }}
          onBlur={() => onRunQuery()}
        />
      </div>
      <div className="gf-form max-width-20">
        <InlineLabel className="query-keyword width-6">Alias</InlineLabel>
        <Input
          placeholder="series alias"
          onChange={(e) => {
            const value = e.currentTarget.value;
            onChange({ ...query, alias: value });
          }}
          onBlur={() => onRunQuery()}
        />
      </div>
    </div>
  );
}

export const testIds = {
  section: 'opentsdb-metricsection',
};
