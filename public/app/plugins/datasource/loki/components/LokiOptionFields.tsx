import { memo } from 'react';
import * as React from 'react';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { InlineField, Input, Stack } from '@grafana/ui';

import { LokiQuery, LokiQueryDirection, LokiQueryType } from '../types';

export interface LokiOptionFieldsProps {
  lineLimitValue: string;
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

if (config.featureToggles.lokiExperimentalStreaming) {
  queryTypeOptions.push({
    value: LokiQueryType.Stream,
    label: 'Stream',
    description: 'Run a query and keep sending results on an interval',
  });
}

export function getQueryDirectionLabel(direction: LokiQueryDirection) {
  return queryDirections.find((queryDirection) => queryDirection.value === direction)?.label ?? 'Unknown';
}

export function LokiOptionFields(props: LokiOptionFieldsProps) {
  const { lineLimitValue, onRunQuery, runOnBlur, onChange } = props;
  const query = props.query ?? {};

  function onChangeQueryLimit(value: string) {
    const nextQuery = { ...query, maxLines: preprocessMaxLines(value) };
    onChange(nextQuery);
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

  return (
    <Stack alignItems="flex-start" gap={0.5} aria-label="Loki extra field">
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
