// Libraries
import React, { memo } from 'react';
import { css, cx } from 'emotion';
import { LokiQuery } from '../types';

// Types
import { InlineFormLabel, RadioButtonGroup, InlineField, Input } from '@grafana/ui';

export interface LokiOptionFieldsProps {
  lineLimitValue: string;
  queryType: LokiQueryType;
  query: LokiQuery;
  onChange: (value: LokiQuery) => void;
  onRunQuery: () => void;
  runOnBlur?: boolean;
}

type LokiQueryType = 'instant' | 'range';

const queryTypeOptions = [
  { value: 'range', label: 'Range' },
  { value: 'instant', label: 'Instant' },
];

export function LokiOptionFields(props: LokiOptionFieldsProps) {
  const { lineLimitValue, queryType, query, onRunQuery, runOnBlur, onChange } = props;

  function onChangeQueryLimit(maxLines: number) {
    const nextQuery = { ...query, maxLines };
    onChange(nextQuery);
  }

  function onQueryTypeChange(value: LokiQueryType) {
    let nextQuery;
    if (value === 'instant') {
      nextQuery = { ...query, instant: true, range: false };
    } else {
      nextQuery = { ...query, instant: false, range: true };
    }
    onChange(nextQuery);
  }

  function onMaxLinesChange(e: React.SyntheticEvent<HTMLInputElement>) {
    //If value is lower than 0, or if it can't be converted into number, we want to return 0
    const limit = Math.max(Number(e.currentTarget.value), 0);
    //Run change only if limit changes
    if (query.maxLines !== limit) {
      onChangeQueryLimit(limit);
    }
  }

  function onReturnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onRunQuery();
    }
  }

  return (
    <div aria-label="Loki extra field" className="gf-form-inline">
      {/*Query type field*/}
      <div
        data-testid="queryTypeField"
        className={cx(
          'gf-form explore-input-margin',
          css`
            flex-wrap: nowrap;
          `
        )}
        aria-label="Query type field"
      >
        <InlineFormLabel
          tooltip="Choose the type of query you would like to run. An instant query queries against a single point in time. A range query queries over a range of time."
          width="auto"
        >
          Query type
        </InlineFormLabel>

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
      </div>
      {/*Line limit field*/}
      <div
        data-testid="lineLimitField"
        className={cx(
          'gf-form',
          css`
            flex-wrap: nowrap;
          `
        )}
        aria-label="Line limit field"
      >
        <InlineField label="Line limit">
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
      </div>
    </div>
  );
}

export default memo(LokiOptionFields);
