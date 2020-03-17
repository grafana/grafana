import React, { memo } from 'react';

// Types
import { ExploreQueryFieldProps } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromQuery, PromOptions } from '../types';

import PromQueryField from './PromQueryField';
import { PromExploreExtraField } from './PromExploreExtraField';

export type Props = ExploreQueryFieldProps<PrometheusDatasource, PromQuery, PromOptions>;

export function PromExploreQueryEditor(props: Props) {
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

  function onReturnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onRunQuery();
    }
  }

  return (
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
          tooltipContent={'Needs to be a valid time unit string, for example 5s, 1m, 3h, 1d, 1y'}
        />
      }
    />
  );
}

export default memo(PromExploreQueryEditor);
