import React, { memo, FC } from 'react';

// Types
import { ExploreQueryFieldProps } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromQuery, PromOptions } from '../types';

import PromQueryField from './PromQueryField';
import { PromExploreExtraField } from './PromExploreExtraField';

export type Props = ExploreQueryFieldProps<PrometheusDatasource, PromQuery, PromOptions>;

export const PromExploreQueryEditor: FC<Props> = (props: Props) => {
  const { range, query, data, datasource, history, onChange, onRunQuery } = props;

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
    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) {
      onRunQuery();
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

  return (
    <PromQueryField
      datasource={datasource}
      query={query}
      range={range}
      onRunQuery={onRunQuery}
      onChange={onChange}
      onBlur={() => {}}
      history={history}
      data={data}
      ExtraFieldElement={
        <PromExploreExtraField
          queryType={query.range && query.instant ? 'both' : query.instant ? 'instant' : 'range'}
          stepValue={query.interval || ''}
          onQueryTypeChange={onQueryTypeChange}
          onStepChange={onStepChange}
          onKeyDownFunc={onReturnKeyDown}
        />
      }
    />
  );
};

export default memo(PromExploreQueryEditor);
