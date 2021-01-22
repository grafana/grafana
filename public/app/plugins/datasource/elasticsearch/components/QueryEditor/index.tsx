import React, { FunctionComponent } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { ElasticDatasource } from '../../datasource';
import { ElasticsearchOptions, ElasticsearchQuery } from '../../types';
import { ElasticsearchProvider } from './ElasticsearchQueryContext';
import { InlineField, InlineFieldRow, Input, QueryField } from '@grafana/ui';
import { changeAliasPattern, changeQuery } from './state';
import { MetricAggregationsEditor } from './MetricAggregationsEditor';
import { BucketAggregationsEditor } from './BucketAggregationsEditor';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { useNextId } from '../../hooks/useNextId';

export type ElasticQueryEditorProps = QueryEditorProps<ElasticDatasource, ElasticsearchQuery, ElasticsearchOptions>;

export const QueryEditor: FunctionComponent<ElasticQueryEditorProps> = ({
  query,
  onChange,
  onRunQuery,
  datasource,
}) => (
  <ElasticsearchProvider datasource={datasource} onChange={onChange} onRunQuery={onRunQuery} query={query}>
    <QueryEditorForm value={query} />
  </ElasticsearchProvider>
);

interface Props {
  value: ElasticsearchQuery;
}

const QueryEditorForm: FunctionComponent<Props> = ({ value }) => {
  const dispatch = useDispatch();
  const nextId = useNextId();

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query" labelWidth={17} grow>
          <QueryField
            query={value.query}
            // By default QueryField calls onChange if onBlur is not defined, this will trigger a rerender
            // And slate will claim the focus, making it impossible to leave the field.
            onBlur={() => {}}
            onChange={(query) => dispatch(changeQuery(query))}
            placeholder="Lucene Query"
            portalOrigin="elasticsearch"
          />
        </InlineField>
        <InlineField label="Alias" labelWidth={15}>
          <Input placeholder="Alias Pattern" onBlur={(e) => dispatch(changeAliasPattern(e.currentTarget.value))} />
        </InlineField>
      </InlineFieldRow>

      <MetricAggregationsEditor nextId={nextId} />
      <BucketAggregationsEditor nextId={nextId} />
    </>
  );
};
