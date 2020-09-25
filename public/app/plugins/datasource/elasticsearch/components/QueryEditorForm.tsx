import React, { ComponentProps, FunctionComponent } from 'react';
import { InlineField, InlineFieldRow, Input, QueryField } from '@grafana/ui';
import { MetricAggregationsEditor } from './MetricAggregationsEditor';
import { useElasticsearchQuery } from './ElasticsearchQueryContext';

const labelsProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 15,
};

export const QueryEditorForm: FunctionComponent = () => {
  const { query, onQueryChange } = useElasticsearchQuery();

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query" {...labelsProps} grow>
          <QueryField
            query={query.query}
            onChange={onQueryChange}
            // onRunQuery={onRunQuery}
            placeholder="Lucene Query"
            portalOrigin="elasticsearch"
          />
        </InlineField>
        <InlineField label="Alias" {...labelsProps}>
          <Input placeholder="Alias Pattern" id="elastic-alias" />
        </InlineField>
      </InlineFieldRow>

      <MetricAggregationsEditor />

      {/* TODO: Bucket Aggregations */}
    </>
  );
};
