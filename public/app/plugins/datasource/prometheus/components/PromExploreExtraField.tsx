// Libraries
import React, { memo } from 'react';
import { css, cx } from '@emotion/css';

// Types
import { InlineFormLabel, RadioButtonGroup } from '@grafana/ui';
import { PromQuery } from '../types';
import { PromExemplarField } from './PromExemplarField';
import { PrometheusDatasource } from '../datasource';

export interface PromExploreExtraFieldProps {
  queryType: string;
  stepValue: string;
  query: PromQuery;
  onStepChange: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onKeyDownFunc: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onQueryTypeChange: (value: string) => void;
  onChange: (value: PromQuery) => void;
  datasource: PrometheusDatasource;
}

export const PromExploreExtraField: React.FC<PromExploreExtraFieldProps> = memo(
  ({ queryType, stepValue, query, onChange, onStepChange, onQueryTypeChange, onKeyDownFunc, datasource }) => {
    const rangeOptions = [
      { value: 'range', label: 'Range', description: 'Run query over a range of time.' },
      {
        value: 'instant',
        label: 'Instant',
        description: 'Run query against a single point in time. For this query, the "To" time is used.',
      },
      { value: 'both', label: 'Both', description: 'Run an Instant query and a Range query.' },
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
          <InlineFormLabel width="auto">Query type</InlineFormLabel>

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

        <PromExemplarField
          refId={query.refId}
          isEnabled={Boolean(query.exemplar)}
          onChange={(isEnabled) => onChange({ ...query, exemplar: isEnabled })}
          datasource={datasource}
        />
      </div>
    );
  }
);
