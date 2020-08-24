import React, { memo, FC, useState } from 'react';

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
  const [selected, setSelected] = useState(query.runAll ? 'all' : query.instant ? 'instant' : 'range');

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
    setSelected(value);
    if (value === 'instant') {
      nextQuery = { ...query, instant: true, runAll: false };
    } else if (value === 'range') {
      nextQuery = { ...query, instant: false, runAll: false };
    } else {
      nextQuery = { ...query, instant: true, runAll: true };
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
      <div style={{ display: 'flex' }}>
        <button className={`gf-form-label gf-form-label--btn`} style={{ width: '78px' }}>
          <span className="btn-title">Query type</span>
        </button>
        <RadioButtonGroup
          options={[
            { value: 'range', label: 'Range' },
            { value: 'instant', label: 'Instant' },
            { value: 'all', label: 'All' },
          ]}
          value={selected}
          onChange={onQueryTypeChange}
        />
      </div>
    </>
  );
};

export default memo(PromExploreQueryEditor);
