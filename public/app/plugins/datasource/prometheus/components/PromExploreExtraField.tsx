// Libraries
import React, { memo } from 'react';
import { css, cx } from '@emotion/css';

// Types
import { InlineFormLabel, RadioButtonGroup, Select } from '@grafana/ui';
import { PromQuery, StepMode } from '../types';
import { PromExemplarField } from './PromExemplarField';
import { PrometheusDatasource } from '../datasource';
import { STEP_MODES } from './PromQueryEditor';
import { SelectableValue } from '@grafana/data';

export interface PromExploreExtraFieldProps {
  queryType: string;
  stepValue: string;
  stepMode: StepMode;
  query: PromQuery;
  onStepModeChange: (option: SelectableValue<StepMode>) => void;
  onStepIntervalChange: (e: React.SyntheticEvent<HTMLInputElement>) => void;
  onKeyDownFunc: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onQueryTypeChange: (value: string) => void;
  onChange: (value: PromQuery) => void;
  datasource: PrometheusDatasource;
}

export const PromExploreExtraField: React.FC<PromExploreExtraFieldProps> = memo(
  ({
    queryType,
    stepValue,
    stepMode,
    query,
    onChange,
    onStepModeChange,
    onStepIntervalChange,
    onQueryTypeChange,
    onKeyDownFunc,
    datasource,
  }) => {
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
          <Select
            menuShouldPortal
            className={'select-container'}
            width={16}
            isSearchable={false}
            options={STEP_MODES}
            onChange={onStepModeChange}
            value={stepMode}
          />
          <input
            type={'text'}
            className="gf-form-input width-4"
            placeholder={'auto'}
            onChange={onStepIntervalChange}
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
