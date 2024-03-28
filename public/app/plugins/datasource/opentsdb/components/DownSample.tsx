import React from 'react';

import { toOption } from '@grafana/data';
import { InlineLabel, Select, Input, InlineFormLabel, InlineSwitch, Stack } from '@grafana/ui';

import { OpenTsdbQuery } from '../types';

export interface DownSampleProps {
  query: OpenTsdbQuery;
  onChange: (query: OpenTsdbQuery) => void;
  onRunQuery: () => void;
  aggregators: string[];
  fillPolicies: string[];
  tsdbVersion: number;
}

export function DownSample({ query, onChange, onRunQuery, aggregators, fillPolicies, tsdbVersion }: DownSampleProps) {
  const aggregatorOptions = aggregators.map((value: string) => toOption(value));
  const fillPolicyOptions = fillPolicies.map((value: string) => toOption(value));

  return (
    <Stack gap={0.5} alignItems="flex-start" data-testid={testIds.section}>
      <Stack gap={0}>
        <InlineFormLabel
          className="query-keyword"
          width={8}
          tooltip={
            <div>
              Leave interval blank for auto or for example use <code>1m</code>
            </div>
          }
        >
          Down sample
        </InlineFormLabel>
        <Input
          width={25}
          data-testid={testIds.interval}
          placeholder="interval"
          value={query.downsampleInterval ?? ''}
          onChange={(e) => {
            const value = e.currentTarget.value;
            onChange({ ...query, downsampleInterval: value });
          }}
          onBlur={() => onRunQuery()}
        />
      </Stack>
      <Stack gap={0}>
        <InlineFormLabel width={'auto'} className="query-keyword">
          Aggregator
        </InlineFormLabel>
        <Select
          value={query.downsampleAggregator ? toOption(query.downsampleAggregator) : undefined}
          options={aggregatorOptions}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, downsampleAggregator: value });
              onRunQuery();
            }
          }}
        />
      </Stack>
      {tsdbVersion >= 2 && (
        <Stack gap={0} alignItems="flex-start">
          <InlineLabel className="width-6 query-keyword">Fill</InlineLabel>
          <Select
            inputId="opentsdb-fillpolicy-select"
            value={query.downsampleFillPolicy ? toOption(query.downsampleFillPolicy) : undefined}
            options={fillPolicyOptions}
            onChange={({ value }) => {
              if (value) {
                onChange({ ...query, downsampleFillPolicy: value });
                onRunQuery();
              }
            }}
          />
        </Stack>
      )}
      <Stack gap={0}>
        <InlineFormLabel className="query-keyword">Disable downsampling</InlineFormLabel>
        <InlineSwitch
          value={query.disableDownsampling ?? false}
          onChange={() => {
            const disableDownsampling = query.disableDownsampling ?? false;
            onChange({ ...query, disableDownsampling: !disableDownsampling });
            onRunQuery();
          }}
        />
      </Stack>
      <Stack gap={0} grow={1}>
        <InlineLabel> </InlineLabel>
      </Stack>
    </Stack>
  );
}

export const testIds = {
  section: 'opentsdb-downsample',
  interval: 'downsample-interval',
};
