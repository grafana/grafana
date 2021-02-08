// Libraries
import React, { memo } from 'react';
import { css, cx } from 'emotion';

// Types
import { InlineFormLabel, RadioButtonGroup } from '@grafana/ui';
import { PromQuery } from '../types';
import { PromExemplarField } from './PromExemplarField';

export interface PromExploreExtraFieldProps {
  queryType: string;
  stepValue: string;
  query: PromQuery;
  onStepChange: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onKeyDownFunc: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onQueryTypeChange: (value: string) => void;
  onChange: (value: PromQuery) => void;
}

export const PromExploreExtraField: React.FC<PromExploreExtraFieldProps> = memo(
  ({ queryType, stepValue, query, onChange, onStepChange, onQueryTypeChange, onKeyDownFunc }) => {
    const rangeOptions = [
      { value: 'range', label: 'Range' },
      { value: 'instant', label: 'Instant' },
      { value: 'both', label: 'Both' },
    ];

    return (
      <div aria-label="Prometheus extra field" className="gf-form-inline">
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
            width="auto"
            tooltip="Choose the type of query you would like to run. An instant query queries against a single point in time. A range query queries over a range of time. With both, you'll run two queries - one instant and one range. "
          >
            Query type
          </InlineFormLabel>

          <RadioButtonGroup options={rangeOptions} value={queryType} onChange={onQueryTypeChange} />
        </div>
        {/*Step field*/}
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
            tooltip={
              'Time units can be used here, for example: 5s, 1m, 3h, 1d, 1y (Default if no unit is specified: s)'
            }
          >
            Step
          </InlineFormLabel>
          <input
            type={'text'}
            className="gf-form-input width-4"
            placeholder={'auto'}
            onChange={onStepChange}
            onKeyDown={onKeyDownFunc}
            value={stepValue}
          />
        </div>

        <PromExemplarField query={query} onChange={onChange} />
      </div>
    );
  }
);
