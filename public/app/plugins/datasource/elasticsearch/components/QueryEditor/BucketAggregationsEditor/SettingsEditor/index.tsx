import { InlineField, Input, Select } from '@grafana/ui';
import React, { ComponentProps } from 'react';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { changeBucketAggregationSetting } from '../state/actions';
import { BucketAggregation } from '../aggregations';
import { bucketAggregationConfig, createOrderByOptionsFromMetrics, orderOptions, sizeOptions } from '../utils';
import { FiltersSettingsEditor } from './FiltersSettingsEditor';
import { useDescription } from './useDescription';
import { useQuery } from '../../ElasticsearchQueryContext';
import { DateHistogramSettingsEditor } from './DateHistogramSettingsEditor';

export const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 16,
};

interface Props {
  bucketAgg: BucketAggregation;
}

export const SettingsEditor = ({ bucketAgg }: Props) => {
  const dispatch = useDispatch();

  const { metrics } = useQuery();
  const settingsDescription = useDescription(bucketAgg);
  const orderBy = createOrderByOptionsFromMetrics(metrics);

  return (
    <SettingsEditorContainer label={settingsDescription}>
      {bucketAgg.type === 'terms' && (
        <>
          <InlineField label="Order" {...inlineFieldProps}>
            <Select
              onChange={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'order', e.value!))}
              options={orderOptions}
              value={bucketAgg.settings?.order || bucketAggregationConfig[bucketAgg.type].defaultSettings?.order}
            />
          </InlineField>

          <InlineField label="Size" {...inlineFieldProps}>
            <Select
              onChange={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'size', e.value!))}
              options={sizeOptions}
              value={bucketAgg.settings?.size || bucketAggregationConfig[bucketAgg.type].defaultSettings?.size}
              allowCustomValue
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'min_doc_count', e.target.value!))}
              defaultValue={
                bucketAgg.settings?.min_doc_count ||
                bucketAggregationConfig[bucketAgg.type].defaultSettings?.min_doc_count
              }
            />
          </InlineField>

          <InlineField label="Order By" {...inlineFieldProps}>
            <Select
              onChange={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'orderBy', e.value!))}
              options={orderBy}
              value={bucketAgg.settings?.orderBy || bucketAggregationConfig[bucketAgg.type].defaultSettings?.orderBy}
            />
          </InlineField>

          <InlineField label="Missing" {...inlineFieldProps}>
            <Input
              onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'missing', e.target.value!))}
              defaultValue={
                bucketAgg.settings?.missing || bucketAggregationConfig[bucketAgg.type].defaultSettings?.missing
              }
            />
          </InlineField>
        </>
      )}

      {bucketAgg.type === 'geohash_grid' && (
        <InlineField label="Precision" {...inlineFieldProps}>
          <Input
            onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'precision', e.target.value!))}
            defaultValue={
              bucketAgg.settings?.precision || bucketAggregationConfig[bucketAgg.type].defaultSettings?.precision
            }
          />
        </InlineField>
      )}

      {bucketAgg.type === 'date_histogram' && <DateHistogramSettingsEditor bucketAgg={bucketAgg} />}

      {bucketAgg.type === 'histogram' && (
        <>
          <InlineField label="Interval" {...inlineFieldProps}>
            <Input
              onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'interval', e.target.value!))}
              defaultValue={
                bucketAgg.settings?.interval || bucketAggregationConfig[bucketAgg.type].defaultSettings?.interval
              }
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'min_doc_count', e.target.value!))}
              defaultValue={
                bucketAgg.settings?.min_doc_count ||
                bucketAggregationConfig[bucketAgg.type].defaultSettings?.min_doc_count
              }
            />
          </InlineField>
        </>
      )}

      {bucketAgg.type === 'filters' && <FiltersSettingsEditor value={bucketAgg} />}
    </SettingsEditorContainer>
  );
};
