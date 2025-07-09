import { Button } from '@grafana/ui';

import { BucketAggregation } from '../../../dataquery.gen';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { useQuery } from '../ElasticsearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';

import { BucketAggregationEditor } from './BucketAggregationEditor';
import { addBucketAggregation, removeBucketAggregation } from './state/actions';

interface Props {
  nextId: BucketAggregation['id'];
}

export const BucketAggregationsEditor = ({ nextId }: Props) => {
  const dispatch = useDispatch();
  const { bucketAggs } = useQuery();
  const totalBucketAggs = bucketAggs?.length || 0;

  return (
    <>
      {bucketAggs!.map((bucketAgg, index) => (
        <QueryEditorRow
          key={`${bucketAgg.type}-${bucketAgg.id}`}
          label={index === 0 ? 'Group By' : 'Then By'}
          onRemoveClick={totalBucketAggs > 1 && (() => dispatch(removeBucketAggregation(bucketAgg.id)))}
        >
          <BucketAggregationEditor value={bucketAgg} />

          {index === 0 && (
            <Button
              variant="secondary"
              fill="text"
              icon="plus"
              onClick={() => dispatch(addBucketAggregation(nextId))}
              tooltip="Add grouping condition"
              aria-label="Add grouping condition"
            />
          )}
        </QueryEditorRow>
      ))}
    </>
  );
};
