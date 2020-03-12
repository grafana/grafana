// Libraries
import React, { memo } from 'react';
import _ from 'lodash';

// Types
import { AbsoluteTimeRange, ExploreQueryFieldProps, ExploreMode } from '@grafana/data';
import { LokiDatasource } from '../datasource';
import { LokiQuery, LokiOptions } from '../types';
import { LokiQueryField } from './LokiQueryField';
import LokiExploreExtraField from './LokiExploreExtraField';

type Props = ExploreQueryFieldProps<LokiDatasource, LokiQuery, LokiOptions>;

export function LokiExploreQueryEditor(props: Props) {
  const { query, data, datasource, exploreMode, history, onChange, onRunQuery } = props;

  let absolute: AbsoluteTimeRange;
  if (data && !_.isEmpty(data.request)) {
    const { range } = data.request;

    absolute = {
      from: range.from.valueOf(),
      to: range.to.valueOf(),
    };
  } else {
    absolute = {
      from: Date.now() - 10000,
      to: Date.now(),
    };
  }

  function onChangeQueryLimit(value: string) {
    const { query, onChange } = props;
    const nextQuery = { ...query, maxLines: preprocessMaxLines(value) };
    onChange(nextQuery);
  }

  function preprocessMaxLines(value: string): number {
    if (value.length === 0) {
      // empty input - falls back to dataSource.maxLines limit
      return NaN;
    } else if (value.length > 0 && (isNaN(+value) || +value < 0)) {
      // input with at least 1 character and that is either incorrect (value in the input field is not a number) or negative
      // falls back to the limit of 0 lines
      return 0;
    } else {
      // default case - correct input
      return +value;
    }
  }

  function onMaxLinesChange(e: React.SyntheticEvent<HTMLInputElement>) {
    if (query.maxLines !== preprocessMaxLines(e.currentTarget.value)) {
      onChangeQueryLimit(e.currentTarget.value);
    }
  }

  function onReturnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onRunQuery();
    }
  }

  return (
    <LokiQueryField
      datasource={datasource}
      query={query}
      onChange={onChange}
      onRunQuery={onRunQuery}
      history={history}
      data={data}
      absoluteRange={absolute}
      ExtraFieldElement={
        exploreMode === ExploreMode.Logs ? (
          <LokiExploreExtraField
            label={'Line limit'}
            onChangeFunc={onMaxLinesChange}
            onKeyDownFunc={onReturnKeyDown}
            value={query?.maxLines?.toString() || ''}
            type={'number'}
            min={0}
          />
        ) : null
      }
    />
  );
}

export default memo(LokiExploreQueryEditor);
