import { Context, createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';

import { TimeRange } from '@grafana/data';

import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { ElasticDatasource } from '../../datasource';
import { combineReducers, useStatelessReducer, DispatchContext } from '../../hooks/useStatelessReducer';

import { createReducer as createBucketAggsReducer } from './BucketAggregationsEditor/state/reducer';
import { reducer as metricsReducer } from './MetricAggregationsEditor/state/reducer';
import { aliasPatternReducer, queryReducer, initQuery } from './state';

const DatasourceContext = createContext<ElasticDatasource | undefined>(undefined);
const QueryContext = createContext<ElasticsearchDataQuery | undefined>(undefined);
const RangeContext = createContext<TimeRange | undefined>(undefined);

interface Props {
  query: ElasticsearchDataQuery;
  onChange: (query: ElasticsearchDataQuery) => void;
  onRunQuery: () => void;
  datasource: ElasticDatasource;
  range: TimeRange;
}

export const ElasticsearchProvider = ({
  children,
  onChange,
  onRunQuery,
  query,
  datasource,
  range,
}: PropsWithChildren<Props>) => {
  const onStateChange = useCallback(
    (query: ElasticsearchDataQuery, prevQuery: ElasticsearchDataQuery) => {
      onChange(query);
      if (query.query === prevQuery.query || prevQuery.query === undefined) {
        onRunQuery();
      }
    },
    [onChange, onRunQuery]
  );

  const reducer = combineReducers<Pick<ElasticsearchDataQuery, 'query' | 'alias' | 'metrics' | 'bucketAggs'>>({
    query: queryReducer,
    alias: aliasPatternReducer,
    metrics: metricsReducer,
    bucketAggs: createBucketAggsReducer(datasource.timeField),
  });

  const dispatch = useStatelessReducer(
    // timeField is part of the query model, but its value is always set to be the one from datasource settings.
    (newState) => onStateChange({ ...query, ...newState, timeField: datasource.timeField }, query),
    query,
    reducer
  );

  const isUninitialized = !query.metrics || !query.bucketAggs || query.query === undefined;

  const [shouldRunInit, setShouldRunInit] = useState(isUninitialized);

  // This initializes the query by dispatching an init action to each reducer.
  // useStatelessReducer will then call `onChange` with the newly generated query
  useEffect(() => {
    if (shouldRunInit && isUninitialized) {
      dispatch(initQuery());
      setShouldRunInit(false);
    }
  }, [shouldRunInit, dispatch, isUninitialized]);

  if (isUninitialized) {
    return null;
  }

  return (
    <DatasourceContext.Provider value={datasource}>
      <QueryContext.Provider value={query}>
        <RangeContext.Provider value={range}>
          <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
        </RangeContext.Provider>
      </QueryContext.Provider>
    </DatasourceContext.Provider>
  );
};

interface GetHook {
  <T>(context: Context<T>): () => NonNullable<T>;
}

const getHook: GetHook = (c) => () => {
  const contextValue = useContext(c);

  if (!contextValue) {
    throw new Error('use ElasticsearchProvider first.');
  }

  return contextValue;
};

export const useQuery = getHook(QueryContext);
export const useDatasource = getHook(DatasourceContext);
export const useRange = getHook(RangeContext);
