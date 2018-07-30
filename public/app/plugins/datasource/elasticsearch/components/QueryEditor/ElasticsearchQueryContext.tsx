import React, { createContext, FunctionComponent, useCallback, useContext } from 'react';
import { ElasticDatasource } from '../../datasource';
import { combineReducers, useStatelessReducer, DispatchContext } from '../../hooks/useStatelessReducer';
import { ElasticsearchQuery } from '../../types';

import { reducer as metricsReducer } from './MetricAggregationsEditor/state/reducer';
import { reducer as bucketAggsReducer } from './BucketAggregationsEditor/state/reducer';
import { aliasPatternReducer, queryReducer, initQuery } from './state';
import { TimeRange } from '@grafana/data';

const DatasourceContext = createContext<ElasticDatasource | undefined>(undefined);
const QueryContext = createContext<ElasticsearchQuery | undefined>(undefined);
const RangeContext = createContext<TimeRange | undefined>(undefined);

interface Props {
  query: ElasticsearchQuery;
  onChange: (query: ElasticsearchQuery) => void;
  onRunQuery: () => void;
  datasource: ElasticDatasource;
  range: TimeRange;
}

export const ElasticsearchProvider: FunctionComponent<Props> = ({
  children,
  onChange,
  onRunQuery,
  query,
  datasource,
  range,
}) => {
  const onStateChange = useCallback(
    (query: ElasticsearchQuery) => {
      onChange(query);
      onRunQuery();
    },
    [onChange, onRunQuery]
  );

  const reducer = combineReducers({
    query: queryReducer,
    alias: aliasPatternReducer,
    metrics: metricsReducer,
    bucketAggs: bucketAggsReducer,
  });

  const dispatch = useStatelessReducer(
    // timeField is part of the query model, but its value is always set to be the one from datasource settings.
    (newState) => onStateChange({ ...query, ...newState, timeField: datasource.timeField }),
    query,
    reducer
  );

  // This initializes the query by dispatching an init action to each reducer.
  // useStatelessReducer will then call `onChange` with the newly generated query
  if (!query.metrics && !query.bucketAggs) {
    dispatch(initQuery());

    return null;
  }

  return (
    <DatasourceContext.Provider value={datasource}>
      <RangeContext.Provider value={range}>
        <QueryContext.Provider value={query}>
          <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
        </QueryContext.Provider>
      </RangeContext.Provider>
    </DatasourceContext.Provider>
  );
};

export const useQuery = (): ElasticsearchQuery => {
  const query = useContext(QueryContext);

  if (!query) {
    throw new Error('use ElasticsearchProvider first.');
  }

  return query;
};

export const useRange = (): TimeRange => {
  const range = useContext(RangeContext);

  if (!range) {
    throw new Error('use ElasticsearchProvider first.');
  }

  return range;
};

export const useDatasource = () => {
  const datasource = useContext(DatasourceContext);
  if (!datasource) {
    throw new Error('use ElasticsearchProvider first.');
  }

  return datasource;
};
