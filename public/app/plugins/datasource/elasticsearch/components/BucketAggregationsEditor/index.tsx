import React, { FunctionComponent } from 'react';
import { InlineFieldRow } from '@grafana/ui';
import { AddRemove } from '../AddRemove';
import { BucketAggregationEditor } from './BucketAggregationEditor';
import { useDispatch } from '../ElasticsearchQueryContext';
import { addBucketAggregation, removeBucketAggregation } from './state/actions';
import { BucketAggregation, BucketAggregationAction } from './state/types';

interface Props {
  value: BucketAggregation[];
}

export const BucketAggregationsEditor: FunctionComponent<Props> = ({ value }) => {
  const dispatch = useDispatch<BucketAggregationAction>();

  return (
    <>
      {JSON.stringify(value, null, 2)}

      {value.map((bucketAgg, index) => (
        <InlineFieldRow key={bucketAgg.id}>
          <BucketAggregationEditor value={bucketAgg} label={index === 0 ? 'Group By' : 'Then By'} />

          <AddRemove
            index={index}
            elements={value}
            onAdd={() => dispatch(addBucketAggregation('date_histogram'))}
            onRemove={() => dispatch(removeBucketAggregation(bucketAgg.id))}
          />
        </InlineFieldRow>
      ))}
    </>
  );
};
