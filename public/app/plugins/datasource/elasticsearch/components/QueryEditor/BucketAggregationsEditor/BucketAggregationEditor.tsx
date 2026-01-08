import { SelectableValue } from '@grafana/data';
import { InlineSegmentGroup, Segment, SegmentAsync } from '@grafana/ui';

import { BucketAggregationType, BucketAggregation } from '../../../dataquery.gen';
import { useFields } from '../../../hooks/useFields';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { segmentStyles } from '../styles';

import { SettingsEditor } from './SettingsEditor';
import { isBucketAggregationWithField } from './aggregations';
import { changeBucketAggregationField, changeBucketAggregationType } from './state/actions';
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
  const dispatch = useDispatch();
  const getFields = useFields(value.type);

  return (
    <>
      <InlineSegmentGroup>
        <Segment
          className={segmentStyles}
          options={bucketAggOptions}
          onChange={(e) => dispatch(changeBucketAggregationType({ id: value.id, newType: e.value! }))}
          value={toOption(value)}
        />

        {isBucketAggregationWithField(value) && (
          <SegmentAsync
            className={segmentStyles}
            loadOptions={getFields}
            onChange={(e) => dispatch(changeBucketAggregationField({ id: value.id, newField: e.value }))}
            placeholder="Select Field"
            value={value.field}
          />
        )}
      </InlineSegmentGroup>

      <SettingsEditor bucketAgg={value} />
    </>
  );
};
