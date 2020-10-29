import React, { FunctionComponent, memo } from 'react';
import { InlineField, InlineFieldRow, Input, QueryField } from '@grafana/ui';
import { MetricAggregationsEditor } from './MetricAggregationsEditor';
import { ElasticsearchQuery } from '../types';
import { BucketAggregationsEditor } from './BucketAggregationsEditor';

interface Props {
  value: ElasticsearchQuery;
}

export const QueryEditorForm: FunctionComponent<Props> = memo(({ value }) => {
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Query" labelWidth={15} grow>
          <QueryField
            query={value.query}
            // onChange={onQueryChange}
            // onRunQuery={onRunQuery}
            placeholder="Lucene Query"
            portalOrigin="elasticsearch"
          />
        </InlineField>
        <InlineField label="Alias" labelWidth={15}>
          <Input
            placeholder="Alias Pattern"
            id="elastic-alias"
            onChange={() => {
              // TODO: Change alias
            }}
          />
        </InlineField>
      </InlineFieldRow>

      <MetricAggregationsEditor value={value.metrics || []} />
      <BucketAggregationsEditor value={value.bucketAggs || []} />
    </>
  );
});
