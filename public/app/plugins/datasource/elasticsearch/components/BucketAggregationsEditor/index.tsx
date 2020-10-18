import React, { FunctionComponent } from 'react';
import { InlineFieldRow } from '@grafana/ui';
import { AddRemove } from '../AddRemove';
import { BucketAggregationEditor } from './BucketAggregationEditor';
import { BucketAggregation } from '../../types';
import { useDispatch } from '../ElasticsearchQueryContext';

interface Props {
  value: BucketAggregation[];
}

export const BucketAggregationsEditor: FunctionComponent<Props> = ({ value }) => {
  const dispatch = useDispatch<any>();

  return (
    <>
      {value.map((bucketAgg, index) => (
        <InlineFieldRow key={bucketAgg.id}>
          <BucketAggregationEditor value={bucketAgg} />

          <AddRemove index={index} elements={value} onAdd={() => {}} onRemove={() => {}} />
        </InlineFieldRow>
      ))}
    </>
  );
};
