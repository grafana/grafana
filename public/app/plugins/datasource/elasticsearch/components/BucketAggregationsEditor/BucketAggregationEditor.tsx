import { SelectableValue } from '@grafana/data';
import { InlineField, Segment, SegmentAsync } from '@grafana/ui';
import React, { ComponentProps, FunctionComponent } from 'react';
import { bucketAggregationConfig } from '../../query_def';
import { useDatasource, useDispatch } from '../ElasticsearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';
import { marginZero } from '../styles';
import { SettingsEditor } from './SettingsEditor';
import { changeBucketAggregationField, changeBucketAggregationType } from './state/actions';
import {
  BucketAggregation,
  BucketAggregationAction,
  BucketAggregationType,
  isBucketAggregationWithField,
} from './state/types';

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
  label: ComponentProps<typeof InlineField>['label'];
}

export const BucketAggregationEditor: FunctionComponent<QueryMetricEditorProps> = ({ value, label }) => {
  const datasource = useDatasource();
  const dispatch = useDispatch<BucketAggregationAction>();

  // TODO: Move this in a hook
  const getFields = () => {
    if (value.type === 'date_histogram') {
      return datasource.getFields('date');
    } else {
      return datasource.getFields();
    }
  };

  return (
    <QueryEditorRow>
      <InlineField label={label} labelWidth={15}>
        <Segment
          className={marginZero}
          options={bucketAggOptions}
          onChange={e => dispatch(changeBucketAggregationType(value.id, e.value!))}
          value={toOption(value)}
        />
      </InlineField>

      {isBucketAggregationWithField(value) && (
        <SegmentAsync
          loadOptions={getFields}
          onChange={e => dispatch(changeBucketAggregationField(value.id, e.value))}
          placeholder="Select Field"
          value={value.field}
        />
      )}

      <SettingsEditor bucketAgg={value} />
    </QueryEditorRow>
  );
};
