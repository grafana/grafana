import React, { memo, FC } from 'react';
import { css } from 'emotion';

// Types
import { ExploreQueryFieldProps } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import { PrometheusDatasource } from '../datasource';
import { PromQuery, PromOptions } from '../types';

import PromQueryField from './PromQueryField';
import { PromExploreExtraField } from './PromExploreExtraField';

export type Props = ExploreQueryFieldProps<PrometheusDatasource, PromQuery, PromOptions>;

export const PromExploreQueryEditor: FC<Props> = (props: Props) => {
  const { query, data, datasource, history, onChange, onRunQuery } = props;

  function onChangeQueryStep(value: string) {
    const { query, onChange } = props;
    const nextQuery = { ...query, interval: value };
    onChange(nextQuery);
  }

  function onStepChange(e: React.SyntheticEvent<HTMLInputElement>) {
    if (e.currentTarget.value !== query.interval) {
      onChangeQueryStep(e.currentTarget.value);
    }
  }

  function onQueryTypeChange(value: string) {
    const { query, onChange } = props;
    let nextQuery;
    if (value === 'instant') {
      nextQuery = { ...query, instant: true, range: false };
    } else if (value === 'range') {
      nextQuery = { ...query, instant: false, range: true };
    } else {
      nextQuery = { ...query, instant: true, range: true };
    }
    onChange(nextQuery);
  }

  function onReturnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onRunQuery();
    }
  }

  return (
    <>
      <PromQueryField
        datasource={datasource}
        query={query}
        onRunQuery={onRunQuery}
        onChange={onChange}
        onBlur={() => {}}
        history={history}
        data={data}
        ExtraFieldElement={
          <PromExploreExtraField
            label={'Step'}
            onChangeFunc={onStepChange}
            onKeyDownFunc={onReturnKeyDown}
            value={query.interval || ''}
            hasTooltip={true}
            tooltipContent={
              'Time units can be used here, for example: 5s, 1m, 3h, 1d, 1y (Default if no unit is specified: s)'
            }
          />
        }
      />
      <PromExploreRadioButton
        selected={query.range && query.instant ? 'both' : query.instant ? 'instant' : 'range'}
        onQueryTypeChange={onQueryTypeChange}
      />
    </>
  );
};

type PromExploreRadioButtonProps = {
  selected: string;
  onQueryTypeChange: (value: string) => void;
};

const PromExploreRadioButton: React.FunctionComponent<PromExploreRadioButtonProps> = ({
  selected,
  onQueryTypeChange,
}) => {
  const rangeOptions = [
    { value: 'range', label: 'Range' },
    { value: 'instant', label: 'Instant' },
    { value: 'both', label: 'Both' },
  ];

  return (
    <div
      className={css`
        display: flex;
      `}
    >
      <button className={`gf-form-label gf-form-label--btn width-5`}>
        <span className="btn-title">Query type</span>
      </button>
      <RadioButtonGroup options={rangeOptions} value={selected} onChange={onQueryTypeChange} />
    </div>
  );
};

export default memo(PromExploreQueryEditor);
