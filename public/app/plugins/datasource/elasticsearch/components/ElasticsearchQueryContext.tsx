import React, { createContext, FunctionComponent, useContext } from 'react';
import { ElasticDatasource } from '../datasource';
import { Action, combineReducers, useReducerCallback } from '../hooks/useReducerCallback';
import { ElasticsearchQuery } from '../types';

import { reducer as metricsReducer } from '../state/metricAggregation/reducer';

const DatasourceContext = createContext<ElasticDatasource | undefined>(undefined);
const DispatchContext = createContext<((action: Action) => void) | undefined>(undefined);
const QueryContext = createContext<ElasticsearchQuery | undefined>(undefined);

interface Props {
  query: ElasticsearchQuery;
  onChange: (query: ElasticsearchQuery) => void;
  datasource: ElasticDatasource;
}

export const ElasticsearchProvider: FunctionComponent<Props> = ({ children, onChange, query, datasource }) => {
  const reducer = combineReducers({
    metrics: metricsReducer,
  });

  const dispatch = useReducerCallback(onChange, query, reducer);

  return (
    <DatasourceContext.Provider value={datasource}>
      <QueryContext.Provider value={query}>
        <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
      </QueryContext.Provider>
    </DatasourceContext.Provider>
  );
};

export const useDispatch = <T extends Action = Action>(): ((action: T) => void) => {
  const dispatch = useContext(DispatchContext);

  if (!dispatch) {
    throw new Error('use ElasticsearchProvider first.');
  }

  return dispatch;
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
