import React, { memo, FC } from 'react';
import { css } from 'emotion';

// Types
import { ExploreQueryFieldProps } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromQuery, PromOptions } from '../types';

import PromQueryField from './PromQueryField';
import { StepField, QueryTypeField } from './PromExploreExtraFields';

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
    <PromQueryField
      datasource={datasource}
      query={query}
      onRunQuery={onRunQuery}
      onChange={onChange}
      onBlur={() => {}}
      history={history}
      data={data}
      ExtraFieldElement={
        <div
          className={css`
            display: flex;
            flex-wrap: wrap;
          `}
        >
          <QueryTypeField
            selected={query.range && query.instant ? 'both' : query.instant ? 'instant' : 'range'}
            onQueryTypeChange={onQueryTypeChange}
          />
          <StepField onChangeFunc={onStepChange} onKeyDownFunc={onReturnKeyDown} value={query.interval || ''} />
        </div>
      }
    />
  );
};

export default memo(PromExploreQueryEditor);
