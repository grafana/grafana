import React, { FunctionComponent } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { ElasticDatasource } from '../datasource';
import { ElasticsearchOptions, ElasticsearchQuery } from '../types';

import { ElasticsearchProvider } from './ElasticsearchQueryContext';
import { QueryEditorForm } from './QueryEditorForm';

export type ElasticQueryEditorProps = QueryEditorProps<ElasticDatasource, ElasticsearchQuery, ElasticsearchOptions>;

export const QueryEditor: FunctionComponent<ElasticQueryEditorProps> = ({
  query,
  onChange,
  datasource,
  onRunQuery,
}) => {
  return (
    <ElasticsearchProvider
      datasource={datasource}
      onChange={newQuery => {
        onChange(newQuery);
        onRunQuery();
      }}
      query={query}
    >
      {JSON.stringify(query.metrics, null, 2)}

      <QueryEditorForm value={query} />
    </ElasticsearchProvider>
  );
};
