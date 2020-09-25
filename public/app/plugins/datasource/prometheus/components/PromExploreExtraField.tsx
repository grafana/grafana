// Libraries
import React, { memo } from 'react';
import { css, cx } from 'emotion';

// Types
import { InlineFormLabel, RadioButtonGroup } from '@grafana/ui';

export interface PromExploreExtraFieldProps {
  queryType: string;
  stepValue: string;
  onStepChange: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onQueryTypeChange: (value: string) => void;
}

const PromExploreExtraField: React.FC<PromExploreExtraFieldProps> = ({
  queryType,
  stepValue,
  onStepChange,
  onQueryTypeChange,
}) => {
  const rangeOptions = [
    { value: 'range', label: 'Range' },
    { value: 'instant', label: 'Instant' },
    { value: 'both', label: 'Both' },
  ];

  const StepField = () => (
    <div
      data-testid="stepField"
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
        onChange={onStepChange}
        value={stepValue}
      />
    </div>
  );

  const QueryTypeField = () => (
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
  );

  return (
    <div
      aria-label="Prometheus extra field"
      className={css`
        display: flex;
        flex-wrap: wrap;
      `}
    >
      <QueryTypeField />
      <StepField />
    </div>
  );
};

export default memo(PromExploreExtraField);
