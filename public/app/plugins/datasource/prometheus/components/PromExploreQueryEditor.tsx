import React, { memo, FC, useEffect } from 'react';

// Types
import { ExploreQueryFieldProps, SelectableValue } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import { PromQuery, PromOptions, StepMode } from '../types';

import PromQueryField from './PromQueryField';
import { PromExploreExtraField } from './PromExploreExtraField';

export type Props = ExploreQueryFieldProps<PrometheusDatasource, PromQuery, PromOptions>;

export const PromExploreQueryEditor: FC<Props> = (props: Props) => {
  const { range, query, data, datasource, history, onChange, onRunQuery } = props;

  useEffect(() => {
    if (query.exemplar === undefined) {
      onChange({ ...query, exemplar: true });
    }
  }, [onChange, query]);

  function onChangeQueryStep(value: string) {
    const { query, onChange } = props;
    const nextQuery = { ...query, interval: value };
    onChange(nextQuery);
  }

  function onChangeStepMode(mode: StepMode) {
    const { query, onChange } = props;
    const nextQuery = { ...query, stepMode: mode };
    onChange(nextQuery);
  }

  function onStepModeChange(option: SelectableValue<StepMode>) {
    if (option.value) {
      onChangeStepMode(option.value);
    }
  }

  function onStepIntervalChange(e: React.SyntheticEvent<HTMLInputElement>) {
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
          // Select "both" as default option when Explore is opened. In legacy requests, range and instant can be undefined. In this case, we want to run queries with "both".
          queryType={query.range === query.instant ? 'both' : query.instant ? 'instant' : 'range'}
          stepValue={query.interval || ''}
          stepMode={query.stepMode || 'min'}
          onQueryTypeChange={onQueryTypeChange}
          onStepModeChange={onStepModeChange}
          onStepIntervalChange={onStepIntervalChange}
          onKeyDownFunc={onReturnKeyDown}
          query={query}
          onChange={onChange}
          datasource={datasource}
        />
      }
    />
  );
};

export default memo(PromExploreQueryEditor);
