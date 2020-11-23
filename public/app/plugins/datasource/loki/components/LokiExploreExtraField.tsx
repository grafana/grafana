// Libraries
import React, { memo } from 'react';
import { css, cx } from 'emotion';

// Types
import { InlineFormLabel, RadioButtonGroup } from '@grafana/ui';

export interface LokiExploreExtraFieldProps {
  lineLimitValue: string;
  queryType: string;
  onLineLimitChange: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onKeyDownFunc: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onQueryTypeChange: (value: string) => void;
}

export function LokiExploreExtraField(props: LokiExploreExtraFieldProps) {
  const { onLineLimitChange, onKeyDownFunc, lineLimitValue, queryType, onQueryTypeChange } = props;

  const rangeOptions = [
    { value: 'range', label: 'Range' },
    { value: 'instant', label: 'Instant' },
  ];

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

        <RadioButtonGroup options={rangeOptions} value={queryType} onChange={onQueryTypeChange} />
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
          onChange={onLineLimitChange}
          onKeyDown={onKeyDownFunc}
          value={lineLimitValue}
        />
      </div>
    </div>
  );
}

export default memo(LokiExploreExtraField);
