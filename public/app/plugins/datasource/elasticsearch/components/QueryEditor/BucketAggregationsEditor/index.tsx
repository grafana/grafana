import React, { FunctionComponent } from 'react';
import { BucketAggregationEditor } from './BucketAggregationEditor';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { addBucketAggregation, removeBucketAggregation } from './state/actions';
import { BucketAggregationAction } from './state/types';
import { BucketAggregation } from './aggregations';
import { useQuery } from '../ElasticsearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';
import { IconButton } from '../../IconButton';

interface Props {
  nextId: BucketAggregation['id'];
}

export const BucketAggregationsEditor: FunctionComponent<Props> = ({ nextId }) => {
  const dispatch = useDispatch<BucketAggregationAction>();
  const { bucketAggs } = useQuery();
  const totalBucketAggs = bucketAggs?.length || 0;

  return (
    <>
      {bucketAggs!.map((bucketAgg, index) => (
        <QueryEditorRow
          key={bucketAgg.id}
          label={index === 0 ? 'Group By' : 'Then By'}
          onRemoveClick={totalBucketAggs > 1 && (() => dispatch(removeBucketAggregation(bucketAgg.id)))}
        >
          <BucketAggregationEditor value={bucketAgg} />

          {index === 0 && (
            <IconButton iconName="plus" onClick={() => dispatch(addBucketAggregation(nextId))} label="add" />
          )}
        </QueryEditorRow>
      ))}
    </>
  );
};
