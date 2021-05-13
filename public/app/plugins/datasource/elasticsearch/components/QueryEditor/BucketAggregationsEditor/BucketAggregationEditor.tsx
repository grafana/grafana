import { SelectableValue } from '@grafana/data';
import { InlineSegmentGroup, Segment, SegmentAsync } from '@grafana/ui';
import React from 'react';
import { useFields } from '../../../hooks/useFields';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { segmentStyles } from '../styles';
import { BucketAggregation, BucketAggregationType, isBucketAggregationWithField } from './aggregations';
import { SettingsEditor } from './SettingsEditor';
import { changeBucketAggregationField, changeBucketAggregationType } from './state/actions';
import { BucketAggregationAction } from './state/types';
import { bucketAggregationConfig } from './utils';

const bucketAggOptions: Array<SelectableValue<BucketAggregationType>> = Object.entries(bucketAggregationConfig).map(
  ([key, { label }]) => ({
    label,
    value: key as BucketAggregationType,
  })
);

const toOption = (bucketAgg: BucketAggregation) => ({
  label: bucketAggregationConfig[bucketAgg.type].label,
  value: bucketAgg.type,
});

interface QueryMetricEditorProps {
  value: BucketAggregation;
}

export const BucketAggregationEditor = ({ value }: QueryMetricEditorProps) => {
  const dispatch = useDispatch<BucketAggregationAction>();
  const getFields = useFields(value.type);

  return (
    <>
      <InlineSegmentGroup>
        <Segment
          className={segmentStyles}
          options={bucketAggOptions}
          onChange={(e) => dispatch(changeBucketAggregationType(value.id, e.value!))}
          value={toOption(value)}
        />

        {isBucketAggregationWithField(value) && (
          <SegmentAsync
            className={segmentStyles}
            loadOptions={getFields}
            onChange={(e) => dispatch(changeBucketAggregationField(value.id, e.value))}
            placeholder="Select Field"
            value={value.field}
          />
        )}
      </InlineSegmentGroup>

      <SettingsEditor bucketAgg={value} />
    </>
  );
};
