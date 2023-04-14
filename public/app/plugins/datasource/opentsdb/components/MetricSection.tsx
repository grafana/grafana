import debounce from 'debounce-promise';
import React from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { Select, Input, InlineFormLabel, AsyncSelect } from '@grafana/ui';

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
    <div className="gf-form-inline" data-testid={testIds.section}>
      <div className="gf-form">
        <InlineFormLabel width={8} className="query-keyword">
          Metric
        </InlineFormLabel>
        {/* metric async select: autocomplete calls opentsdb suggest API */}
        <AsyncSelect
          width={25}
          inputId="opentsdb-metric-select"
          className="gf-form-input"
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
