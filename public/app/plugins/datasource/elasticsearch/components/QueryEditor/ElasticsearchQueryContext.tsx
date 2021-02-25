import React, { createContext, FunctionComponent, useCallback, useContext } from 'react';
import { ElasticDatasource } from '../../datasource';
import { combineReducers, useStatelessReducer, DispatchContext } from '../../hooks/useStatelessReducer';
import { ElasticsearchQuery } from '../../types';

import { reducer as metricsReducer } from './MetricAggregationsEditor/state/reducer';
import { reducer as bucketAggsReducer } from './BucketAggregationsEditor/state/reducer';
import { aliasPatternReducer, queryReducer, initQuery } from './state';

const DatasourceContext = createContext<ElasticDatasource | undefined>(undefined);
const QueryContext = createContext<ElasticsearchQuery | undefined>(undefined);

interface Props {
  query: ElasticsearchQuery;
  onChange: (query: ElasticsearchQuery) => void;
  onRunQuery: () => void;
  datasource: ElasticDatasource;
}

export const ElasticsearchProvider: FunctionComponent<Props> = ({
  children,
  onChange,
  onRunQuery,
  query,
  datasource,
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
  if (!query.metrics || !query.bucketAggs || query.query === undefined) {
    dispatch(initQuery());

    return null;
  }

  return (
    <DatasourceContext.Provider value={datasource}>
      <QueryContext.Provider value={query}>
        <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
      </QueryContext.Provider>
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

export const useDatasource = () => {
  const datasource = useContext(DatasourceContext);
  if (!datasource) {
    throw new Error('use ElasticsearchProvider first.');
  }

  return datasource;
};
