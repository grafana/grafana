import React, { createContext, FunctionComponent, useContext } from 'react';
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
  datasource: ElasticDatasource;
}

export const ElasticsearchProvider: FunctionComponent<Props> = ({ children, onChange, query, datasource }) => {
  const reducer = combineReducers({
    query: queryReducer,
    alias: aliasPatternReducer,
    metrics: metricsReducer,
    bucketAggs: bucketAggsReducer,
  });

  const dispatch = useStatelessReducer(newState => onChange({ ...query, ...newState }), query, reducer);

  // This initializes the query by dispatching an init action to each reducer.
  // useStatelessReducer will then call `onChange` with the newly generated query
  if (!query.metrics && !query.bucketAggs) {
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
