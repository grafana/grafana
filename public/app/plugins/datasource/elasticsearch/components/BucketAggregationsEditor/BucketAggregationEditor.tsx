import { SelectableValue } from '@grafana/data';
import { InlineField, Segment, SegmentAsync } from '@grafana/ui';
import React, { FunctionComponent } from 'react';
import { bucketAggregationConfig } from '../../query_def';
import { BucketAggregation, BucketAggregationType } from '../../types';
import { useDatasource } from '../ElasticsearchQueryContext';
import { marginZero } from '../styles';

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
  bucketAgg: BucketAggregation;
  onChange: (bucketAgg: BucketAggregation) => void;
}

export const BucketAggregationEditor: FunctionComponent<QueryMetricEditorProps> = ({ bucketAgg, onChange }) => {
  const datasource = useDatasource();

  const getFields = () => {
    if (bucketAgg.type === 'date_histogram') {
      return datasource.getFields('date');
    } else {
      return datasource.getFields();
    }
  };

  return (
    <>
      <InlineField label="Group By" labelWidth={15}>
        <Segment
          className={marginZero}
          options={bucketAggOptions}
          onChange={e => {
            console.log(e);
            // TODO: This
          }}
          value={toOption(bucketAgg)}
        />
      </InlineField>

      {bucketAggregationConfig[bucketAgg.type].requiresField && (
        <SegmentAsync loadOptions={getFields} onChange={() => {}} placeholder="Select Field" value={bucketAgg.field} />
      )}
    </>
  );
};
