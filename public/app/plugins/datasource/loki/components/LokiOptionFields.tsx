// Libraries
import React, { memo } from 'react';
import { css, cx } from 'emotion';
import { LokiQuery } from '../types';

// Types
import { InlineFormLabel, RadioButtonGroup } from '@grafana/ui';

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

  function onChangeQueryLimit(value: string) {
    const nextQuery = { ...query, maxLines: preprocessMaxLines(value) };
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

  function preprocessMaxLines(value: string): number {
    if (value.length === 0) {
      // empty input - falls back to dataSource.maxLines limit
      return NaN;
    } else if (value.length > 0 && (isNaN(+value) || +value < 0)) {
      // input with at least 1 character and that is either incorrect (value in the input field is not a number) or negative
      // falls back to the limit of 0 lines
      return 0;
    } else {
      // default case - correct input
      return +value;
    }
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
        <InlineFormLabel width={5}>Line limit</InlineFormLabel>
        <input
          type="number"
          className="gf-form-input width-4"
          placeholder={'auto'}
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
      </div>
    </div>
  );
}

export default memo(LokiOptionFields);
