import { InlineField, Input, Select } from '@grafana/ui';
import React, { ComponentProps, FunctionComponent } from 'react';
import { useDispatch } from '../../ElasticsearchQueryContext';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { changeBucketAggregationSetting } from '../state/actions';
import { BucketAggregation } from '../state/types';

const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 16,
};

// TODO: Move the following somewhere else
const orderOptions = [
  { label: 'Top', value: 'desc' },
  { label: 'Bottom', value: 'asc' },
];

const sizeOptions = [
  { label: 'No limit', value: '0' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '5', value: '5' },
  { label: '10', value: '10' },
  { label: '15', value: '15' },
  { label: '20', value: '20' },
];

const orderByOptions = [
  { label: 'Doc Count', value: '_count' },
  { label: 'Term value', value: '_term' },
];

interface Props {
  bucketAgg: BucketAggregation;
}

export const SettingsEditor: FunctionComponent<Props> = ({ bucketAgg }) => {
  const dispatch = useDispatch();

  return (
    <SettingsEditorContainer label="Settings">
      {bucketAgg.type === 'terms' && (
        <>
          <InlineField label="Order" {...inlineFieldProps}>
            <Select
              onChange={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'order', e.value!))}
              options={orderOptions}
              defaultValue={bucketAgg.settings?.order}
            />
          </InlineField>

          <InlineField label="Size" {...inlineFieldProps}>
            <Select
              onChange={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'size', e.value!))}
              options={sizeOptions}
              defaultValue={bucketAgg.settings?.size}
              allowCustomValue
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              onBlur={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'min_doc_count', e.target.value!))}
              defaultValue={bucketAgg.settings?.min_doc_count ?? '0'}
            />
          </InlineField>

          <InlineField label="Order By" {...inlineFieldProps}>
            <Select
              onChange={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'orderBy', e.value!))}
              // TODO: This can also select from previously selected metrics
              options={orderByOptions}
              defaultValue={bucketAgg.settings?.orderBy}
            />
          </InlineField>

          <InlineField label="Missing" {...inlineFieldProps}>
            <Input
              onBlur={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'missing', e.target.value!))}
              defaultValue={bucketAgg.settings?.missing}
            />
          </InlineField>
        </>
      )}

      {bucketAgg.type === 'geohash_grid' && (
        <InlineField label="Precision" {...inlineFieldProps}>
          <Input
            onBlur={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'precision', e.target.value!))}
            defaultValue={bucketAgg.settings?.precision ?? '3'}
          />
        </InlineField>
      )}
    </SettingsEditorContainer>
  );
};
