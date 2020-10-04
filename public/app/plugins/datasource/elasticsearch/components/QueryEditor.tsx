import React, { FunctionComponent, useReducer } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { ElasticDatasource } from '../datasource';
import { ElasticsearchOptions, ElasticsearchQuery } from '../types';

// import { QueryEditorForm } from './QueryEditorForm';
// import { ElasticsearchQueryProvider } from './ElasticsearchQueryContext';
import { combineReducers, useReducerCallback } from '../hooks/useReducerCallback';
import { reducer as metricsReducer } from '../state/metricAggregation/reducer';

export type ElasticQueryEditorProps = QueryEditorProps<ElasticDatasource, ElasticsearchQuery, ElasticsearchOptions>;

export const QueryEditor: FunctionComponent<ElasticQueryEditorProps> = ({ query, onChange, datasource }) => {
  const reducer = combineReducers({
    metrics: metricsReducer,
  });

  const dispatch = useReducerCallback(onChange, query, (state, action) => state);

  return <>{JSON.stringify(query)}</>;
  // return (
  //   <ElasticsearchQueryProvider query={query} onChange={onChange} datasource={datasource}>
  //     {JSON.stringify(query)}

  //     <QueryEditorForm />
  //   </ElasticsearchQueryProvider>
  // );
};
