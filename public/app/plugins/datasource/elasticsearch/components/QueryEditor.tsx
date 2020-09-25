import React, { FunctionComponent } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { ElasticDatasource } from '../datasource';
import { ElasticsearchOptions, ElasticsearchQuery } from '../types';

import { QueryEditorForm } from './QueryEditorForm';
import { ElasticsearchQueryProvider } from './ElasticsearchQueryContext';

export type ElasticQueryEditorProps = QueryEditorProps<ElasticDatasource, ElasticsearchQuery, ElasticsearchOptions>;

export const QueryEditor: FunctionComponent<ElasticQueryEditorProps> = ({ query, onChange, datasource }) => {
  return (
    <ElasticsearchQueryProvider query={query} onChange={onChange} datasource={datasource}>
      {JSON.stringify(query)}

      <QueryEditorForm />
    </ElasticsearchQueryProvider>
  );
};
