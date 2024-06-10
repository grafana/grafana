import React from 'react';

import { InlineLabel, Input, InlineFormLabel, InlineSwitch, Stack } from '@grafana/ui';

import { OpenTsdbQuery } from '../types';

export interface RateSectionProps {
  query: OpenTsdbQuery;
  onChange: (query: OpenTsdbQuery) => void;
  onRunQuery: () => void;
  tsdbVersion: number;
}

export function RateSection({ query, onChange, onRunQuery, tsdbVersion }: RateSectionProps) {
  return (
    <Stack gap={0} data-testid={testIds.section}>
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

      {query.shouldComputeRate && (
        <>
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
        </>
      )}
      {query.shouldComputeRate && query.isCounter && (
        <Stack gap={0}>
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
        </Stack>
      )}
      {tsdbVersion > 2 && (
        <>
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
        </>
      )}
      <Stack gap={0} grow={1}>
        <InlineLabel> </InlineLabel>
      </Stack>
    </Stack>
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
