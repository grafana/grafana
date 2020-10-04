import React, { createContext, FunctionComponent, useContext } from 'react';
import { ElasticDatasource } from '../datasource';
import { Action, combineReducers, useReducerCallback } from '../hooks/useReducerCallback';
import { ElasticsearchQuery } from '../types';

import { reducer as metricsReducer } from '../state/metricAggregation/reducer';

const DatasourceContext = createContext<ElasticDatasource | undefined>(undefined);
const DispatchContext = createContext<((action: Action) => void) | undefined>(undefined);

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
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </DatasourceContext.Provider>
  );
};

export const useDispatch = <T extends Action = Action>(): ((action: T) => void) => {
  const dispatch = useContext(DispatchContext);

  if (!dispatch) {
    throw new Error('use ElasticsearchProvider first.');
  }

  return dispatch;

  // const addMetric = () => {
  //   const lastId = query.metrics[query.metrics.length - 1].id;
  //   onChange({
  //     ...query,
  //     metrics: [...query.metrics, defaultMetricAgg(lastId + 1)],
  //   });
  // };

  // const removeMetric = (index: number) => {
  //   onChange({
  //     ...query,
  //     metrics: query.metrics.slice(0, index).concat(query.metrics.slice(index + 1)),
  //   });
  // };

  // const changeMetric = (index: number) => (newMetric: MetricAggregation) => {
  //   const newMetrics = !!metricAggregationConfig[newMetric.type].isSingleMetric
  //     ? [newMetric]
  //     : query.metrics
  //         .slice(0, index)
  //         .concat(newMetric)
  //         .concat(query.metrics.slice(index + 1));

  //   onChange({
  //     ...query,
  //     metrics: newMetrics,
  //     // TODO: If raw_document or raw_data also clear bucketAggs
  //   });
  // };

  // const addBucketAggregation = () => {
  //   const lastId = query.bucketAggs[query.bucketAggs.length - 1].id;
  //   onChange({
  //     ...query,
  //     bucketAggs: [...query.bucketAggs, defaultBucketAgg(lastId + 1)],
  //   });
  // };

  // const removeBucketAggregation = (index: number) => {
  //   onChange({
  //     ...query,
  //     bucketAggs: query.bucketAggs.slice(0, index).concat(query.bucketAggs.slice(index + 1)),
  //   });
  // };

  // const onQueryChange = (queryString: string) => {
  //   onChange({
  //     ...query,
  //     query: queryString,
  //   });
  // };
};

export const useDatasource = () => {
  const datasource = useContext(DatasourceContext);
  if (!datasource) {
    throw new Error('use ElasticsearchProvider first.');
  }

  return datasource;
};
