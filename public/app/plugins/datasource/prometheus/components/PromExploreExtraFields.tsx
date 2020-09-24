// Libraries
import React, { memo } from 'react';
import { css, cx } from 'emotion';

// Types
import { InlineFormLabel, RadioButtonGroup } from '@grafana/ui';

export interface StepFieldProps {
  onChangeFunc: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onKeyDownFunc: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  value: string;
}

type QueryTypeFieldProps = {
  selected: string;
  onQueryTypeChange: (value: string) => void;
};

export const StepField: React.FC<StepFieldProps> = memo(({ onChangeFunc, onKeyDownFunc, value }) => {
  return (
    <div
      className={cx(
        'gf-form',
        css`
          flex-wrap: nowrap;
        `
      )}
      aria-label="Step field"
    >
      <InlineFormLabel
        width={5}
        tooltip={'Time units can be used here, for example: 5s, 1m, 3h, 1d, 1y (Default if no unit is specified: s)'}
      >
        Step
      </InlineFormLabel>
      <input
        type={'text'}
        className="gf-form-input width-4"
        placeholder={'auto'}
        onChange={onChangeFunc}
        onKeyDown={onKeyDownFunc}
        value={value}
      />
    </div>
  );
});

export const QueryTypeField: React.FC<QueryTypeFieldProps> = React.memo(({ selected, onQueryTypeChange }) => {
  const rangeOptions = [
    { value: 'range', label: 'Range' },
    { value: 'instant', label: 'Instant' },
    { value: 'both', label: 'Both' },
  ];

  return (
    <div
      className={cx(
        'gf-form explore-input-margin',
        css`
          flex-wrap: nowrap;
        `
      )}
      aria-label="Query type field"
    >
      <InlineFormLabel width={5}>Query type</InlineFormLabel>

      <RadioButtonGroup options={rangeOptions} value={selected} onChange={onQueryTypeChange} />
    </div>
  );
});
