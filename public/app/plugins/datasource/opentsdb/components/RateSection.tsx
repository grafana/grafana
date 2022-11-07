import React from 'react';

import { InlineLabel, Input, InlineFormLabel, InlineSwitch } from '@grafana/ui';

import { OpenTsdbQuery } from '../types';

export interface RateSectionProps {
  query: OpenTsdbQuery;
  onChange: (query: OpenTsdbQuery) => void;
  onRunQuery: () => void;
  tsdbVersion: number;
}

export function RateSection({ query, onChange, onRunQuery, tsdbVersion }: RateSectionProps) {
  return (
    <div className="gf-form-inline" data-testid={testIds.section}>
      <div className="gf-form">
        <InlineFormLabel className="query-keyword" width={8}>
          Rate
        </InlineFormLabel>
        <InlineSwitch
          data-testid={testIds.shouldComputeRate}
          value={query.shouldComputeRate ?? false}
          onChange={() => {
            const shouldComputeRate = query.shouldComputeRate ?? false;
            onChange({ ...query, shouldComputeRate: !shouldComputeRate });
            onRunQuery();
          }}
        />
      </div>
      {query.shouldComputeRate && (
        <div className="gf-form">
          <InlineFormLabel className="query-keyword" width={'auto'}>
            Counter
          </InlineFormLabel>
          <InlineSwitch
            data-testid={testIds.isCounter}
            value={query.isCounter ?? false}
            onChange={() => {
              const isCounter = query.isCounter ?? false;
              onChange({ ...query, isCounter: !isCounter });
              onRunQuery();
            }}
          />
        </div>
      )}
      {query.shouldComputeRate && query.isCounter && (
        <div className="gf-form">
          <InlineLabel width={'auto'} className="query-keyword">
            Counter max
          </InlineLabel>
          <Input
            data-testid={testIds.counterMax}
            placeholder="max value"
            value={query.counterMax ?? ''}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange({ ...query, counterMax: value });
            }}
            onBlur={() => onRunQuery()}
          />
          <InlineLabel width={'auto'} className="query-keyword">
            Reset value
          </InlineLabel>
          <Input
            data-testid={testIds.counterResetValue}
            placeholder="reset value"
            value={query.counterResetValue ?? ''}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange({ ...query, counterResetValue: value });
            }}
            onBlur={() => onRunQuery()}
          />
        </div>
      )}
      {tsdbVersion > 2 && (
        <div className="gf-form">
          <InlineFormLabel className="query-keyword" width={'auto'}>
            Explicit tags
          </InlineFormLabel>
          <InlineSwitch
            data-testid={testIds.explicitTags}
            value={query.explicitTags ?? false}
            onChange={() => {
              const explicitTags = query.explicitTags ?? false;
              onChange({ ...query, explicitTags: !explicitTags });
              onRunQuery();
            }}
          />
        </div>
      )}
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow"></div>
      </div>
    </div>
  );
}

export const testIds = {
  section: 'opentsdb-rate',
  shouldComputeRate: 'opentsdb-shouldComputeRate',
  isCounter: 'opentsdb-is-counter',
  counterMax: 'opentsdb-counter-max',
  counterResetValue: 'opentsdb-counter-reset-value',
  explicitTags: 'opentsdb-explicit-tags',
};
