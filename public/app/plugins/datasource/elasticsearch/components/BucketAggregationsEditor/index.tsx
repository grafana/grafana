import React, { FunctionComponent } from 'react';
import { InlineFieldRow } from '@grafana/ui';
import { AddRemove } from '../AddRemove';
import { BucketAggregationEditor } from './BucketAggregationEditor';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { addBucketAggregation, removeBucketAggregation } from './state/actions';
import { BucketAggregationAction } from './state/types';
import { BucketAggregation } from './aggregations';

interface Props {
  value: BucketAggregation[];
  nextId: BucketAggregation['id'];
}

export const BucketAggregationsEditor: FunctionComponent<Props> = ({ value, nextId }) => {
  const dispatch = useDispatch<BucketAggregationAction>();

  return (
    <>
      {value.map((bucketAgg, index) => (
        <InlineFieldRow key={bucketAgg.id}>
          <BucketAggregationEditor value={bucketAgg} label={index === 0 ? 'Group By' : 'Then By'} />

          <AddRemove
            index={index}
            elements={value}
            onAdd={() => dispatch(addBucketAggregation(nextId))}
            onRemove={() => dispatch(removeBucketAggregation(bucketAgg.id))}
          />
        </InlineFieldRow>
      ))}
    </>
  );
};
