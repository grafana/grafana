// Libraries
import React, { memo } from 'react';
import { css, cx } from 'emotion';

// Types
import { InlineFormLabel, RadioButtonGroup } from '@grafana/ui';

export interface LokiExploreExtraFieldProps {
  lineLimitValue: string;
  queryType: string;
  onLimitChange: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onKeyDownFunc: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onQueryTypeChange: (value: string) => void;
}

export function LokiExploreExtraField(props: LokiExploreExtraFieldProps) {
  const { onLimitChange, onKeyDownFunc, lineLimitValue, queryType, onQueryTypeChange } = props;

  const rangeOptions = [
    { value: 'range', label: 'Range' },
    { value: 'instant', label: 'Instant' },
    { value: 'both', label: 'Both' },
  ];

  return (
    <div aria-label="Loki extra field" className="gf-form-inline">
      {/*QueryTypeField */}
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
        <InlineFormLabel width={5}>Query type</InlineFormLabel>

        <RadioButtonGroup options={rangeOptions} value={queryType} onChange={onQueryTypeChange} />
      </div>
      {/*Line limit field*/}
      <div
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
          onChange={onLimitChange}
          onKeyDown={onKeyDownFunc}
          value={lineLimitValue}
        />
      </div>
    </div>
  );
}

export default memo(LokiExploreExtraField);
