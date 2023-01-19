import React from 'react';

import { toOption } from '@grafana/data';
import { InlineLabel, Select, Input, InlineFormLabel, InlineSwitch } from '@grafana/ui';

import { OpenTsdbQuery } from '../types';

import { paddingRightClass } from './styles';

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
    <div className="gf-form-inline" data-testid={testIds.section}>
      <div className="gf-form">
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
          className={paddingRightClass}
          data-testid={testIds.interval}
          placeholder="interval"
          value={query.downsampleInterval ?? ''}
          onChange={(e) => {
            const value = e.currentTarget.value;
            onChange({ ...query, downsampleInterval: value });
          }}
          onBlur={() => onRunQuery()}
        />
      </div>
      <div className="gf-form">
        <InlineFormLabel width={'auto'} className="query-keyword">
          Aggregator
        </InlineFormLabel>
        <Select
          className="gf-form-input"
          value={query.downsampleAggregator ? toOption(query.downsampleAggregator) : undefined}
          options={aggregatorOptions}
          onChange={({ value }) => {
            if (value) {
              onChange({ ...query, downsampleAggregator: value });
              onRunQuery();
            }
          }}
        />
      </div>
      {tsdbVersion >= 2 && (
        <div className="gf-form">
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
        </div>
      )}
      <div className="gf-form">
        <InlineFormLabel className="query-keyword">Disable downsampling</InlineFormLabel>
        <InlineSwitch
          value={query.disableDownsampling ?? false}
          onChange={() => {
            const disableDownsampling = query.disableDownsampling ?? false;
            onChange({ ...query, disableDownsampling: !disableDownsampling });
            onRunQuery();
          }}
        />
      </div>
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow"></div>
      </div>
    </div>
  );
}

export const testIds = {
  section: 'opentsdb-downsample',
  interval: 'downsample-interval',
};
