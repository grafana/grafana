// Libraries
import { map } from 'lodash';
import { memo } from 'react';
import * as React from 'react';

// Types
import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { InlineFormLabel, RadioButtonGroup, InlineField, Input, Select, Stack } from '@grafana/ui';

import { getLokiQueryType } from '../queryUtils';
import { LokiQuery, LokiQueryDirection, LokiQueryType } from '../types';

export interface LokiOptionFieldsProps {
  lineLimitValue: string;
  resolution: number;
  query: LokiQuery;
  onChange: (value: LokiQuery) => void;
  onRunQuery: () => void;
  runOnBlur?: boolean;
}

export const queryTypeOptions: Array<SelectableValue<LokiQueryType>> = [
  { value: LokiQueryType.Range, label: 'Range', description: 'Run query over a range of time.' },
  {
    value: LokiQueryType.Instant,
    label: 'Instant',
    description: 'Run query against a single point in time. For this query, the "To" time is used.',
  },
];

export const queryDirections: Array<SelectableValue<LokiQueryDirection>> = [
  { value: LokiQueryDirection.Backward, label: 'Backward', description: 'Search in backward direction.' },
  {
    value: LokiQueryDirection.Forward,
    label: 'Forward',
    description: 'Search in forward direction.',
  },
];

if (config.featureToggles.lokiShardSplitting) {
  queryDirections.push({
    value: LokiQueryDirection.Scan,
    label: 'Scan',
    description: 'Experimental. Split the query into smaller units and stop at the requested log line limit.',
    icon: 'exclamation-triangle',
  });
}

export function getQueryDirectionLabel(direction: LokiQueryDirection) {
  return queryDirections.find((queryDirection) => queryDirection.value === direction)?.label ?? 'Unknown';
}

if (config.featureToggles.lokiExperimentalStreaming) {
  queryTypeOptions.push({
    value: LokiQueryType.Stream,
    label: 'Stream',
    description: 'Run a query and keep sending results on an interval',
  });
}

export const DEFAULT_RESOLUTION: SelectableValue<number> = {
  value: 1,
  label: '1/1',
};

export const RESOLUTION_OPTIONS: Array<SelectableValue<number>> = [DEFAULT_RESOLUTION].concat(
  map([2, 3, 4, 5, 10], (value: number) => ({
    value,
    label: '1/' + value,
  }))
);

export function LokiOptionFields(props: LokiOptionFieldsProps) {
  const { lineLimitValue, resolution, onRunQuery, runOnBlur, onChange } = props;
  const query = props.query ?? {};
  const queryType = getLokiQueryType(query);

  function onChangeQueryLimit(value: string) {
    const nextQuery = { ...query, maxLines: preprocessMaxLines(value) };
    onChange(nextQuery);
  }

  function onQueryTypeChange(queryType: LokiQueryType) {
    const { instant, range, ...rest } = query;
    onChange({ ...rest, queryType });
  }

  function onMaxLinesChange(e: React.SyntheticEvent<HTMLInputElement>) {
    if (query.maxLines !== preprocessMaxLines(e.currentTarget.value)) {
      onChangeQueryLimit(e.currentTarget.value);
    }
  }

  function onReturnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onRunQuery();
    }
  }

  function onResolutionChange(option: SelectableValue<number>) {
    const nextQuery = { ...query, resolution: option.value };
    onChange(nextQuery);
  }

  return (
    <Stack alignItems="flex-start" gap={0.5} aria-label="Loki extra field">
      {/*Query type field*/}
      <Stack wrap="nowrap" gap={0} data-testid="queryTypeField" aria-label="Query type field">
        <InlineFormLabel width="auto">Query type</InlineFormLabel>

        <RadioButtonGroup
          options={queryTypeOptions}
          value={queryType}
          onChange={(type: LokiQueryType) => {
            onQueryTypeChange(type);
            if (runOnBlur) {
              onRunQuery();
            }
          }}
        />
      </Stack>
      {/*Line limit field*/}
      <Stack wrap="nowrap" gap={0} data-testid="lineLimitField" aria-label="Line limit field">
        <InlineField label="Line limit" tooltip={'Upper limit for number of log lines returned by query.'}>
          <Input
            className="width-4"
            placeholder="auto"
            type="number"
            min={0}
            onChange={onMaxLinesChange}
            onKeyDown={onReturnKeyDown}
            value={lineLimitValue}
            onBlur={() => {
              if (runOnBlur) {
                onRunQuery();
              }
            }}
          />
        </InlineField>
        <InlineField
          label="Resolution"
          tooltip={
            'Resolution 1/1 sets step parameter of Loki metrics range queries such that each pixel corresponds to one data point. For better performance, lower resolutions can be picked. 1/2 only retrieves a data point for every other pixel, and 1/10 retrieves one data point per 10 pixels.'
          }
        >
          <Select
            isSearchable={false}
            onChange={onResolutionChange}
            options={RESOLUTION_OPTIONS}
            value={resolution}
            aria-label="Select resolution"
          />
        </InlineField>
      </Stack>
    </Stack>
  );
}

export default memo(LokiOptionFields);

export function preprocessMaxLines(value: string): number | undefined {
  const maxLines = parseInt(value, 10);
  if (isNaN(maxLines) || maxLines < 0) {
    return undefined;
  }

  return maxLines;
}
