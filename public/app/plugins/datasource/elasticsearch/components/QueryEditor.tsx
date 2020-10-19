import React, { FunctionComponent, useCallback } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { ElasticDatasource } from '../datasource';
import { ElasticsearchOptions, ElasticsearchQuery } from '../types';

import { ElasticsearchProvider } from './ElasticsearchQueryContext';
import { QueryEditorForm } from './QueryEditorForm';

export type ElasticQueryEditorProps = QueryEditorProps<ElasticDatasource, ElasticsearchQuery, ElasticsearchOptions>;

// We could memoize the editor if we rafactor onChange to not be an anonymous function
export const QueryEditor: FunctionComponent<ElasticQueryEditorProps> = ({
  query,
  // onChange is an anonymous function, if we can change it we could avoid to rerender the form on every update
  onChange,
  datasource,
  onRunQuery,
}) => {
  const onQueryChange = useCallback(
    newQuery => {
      onChange(newQuery);
      onRunQuery();
    },
    [onChange, onRunQuery]
  );

  return (
    <ElasticsearchProvider datasource={datasource} onChange={onQueryChange} query={query}>
      <QueryEditorForm value={query} />
    </ElasticsearchProvider>
  );
};
