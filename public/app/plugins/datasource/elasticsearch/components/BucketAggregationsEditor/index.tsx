import React, { FunctionComponent } from 'react';
import { InlineFieldRow } from '@grafana/ui';
import { AddRemove } from '../AddRemove';
import { useElasticsearchQuery } from '../ElasticsearchQueryContext';
import { BucketAggregationEditor } from './BucketAggregationEditor';

export const BucketAggregationsEditor: FunctionComponent = () => {
  const { query, addBucketAggregation, removeBucketAggregation } = useElasticsearchQuery();

  return (
    <>
      {query.bucketAggs.map((bucketAgg, index) => (
        <InlineFieldRow key={bucketAgg.id}>
          <BucketAggregationEditor bucketAgg={bucketAgg} />

          <AddRemove
            index={index}
            elements={query.bucketAggs}
            onAdd={addBucketAggregation}
            onRemove={removeBucketAggregation}
          />
        </InlineFieldRow>
      ))}
    </>
  );
};
