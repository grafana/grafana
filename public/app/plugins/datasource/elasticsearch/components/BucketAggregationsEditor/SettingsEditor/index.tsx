import { SelectableValue } from '@grafana/data';
import { InlineField, Input, Select } from '@grafana/ui';
import React, { ComponentProps, FunctionComponent } from 'react';
import { useDispatch } from '../../ElasticsearchQueryContext';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { changeBucketAggregationSetting } from '../state/actions';
import { BucketAggregation } from '../state/types';
import { intervalOptions, orderByOptions, orderOptions, sizeOptions } from '../utils';
import { FiltersSettingsEditor } from './TermsSettingsEditor';
import { useDescription } from './useDescription';

const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 16,
};

const selectDefaultValue = (options: SelectableValue[], value?: string | SelectableValue): SelectableValue => {
  if (!value) {
    return options[0];
  }

  const option = options.find(o => o.value === value);
  if (option) {
    return option;
  }

  if (typeof value === 'string') {
    return { value, label: value };
  }

  return value;
};

interface Props {
  bucketAgg: BucketAggregation;
}

export const SettingsEditor: FunctionComponent<Props> = ({ bucketAgg }) => {
  const dispatch = useDispatch();
  const settingsDescription = useDescription(bucketAgg);

  return (
    <SettingsEditorContainer label={settingsDescription}>
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

      {bucketAgg.type === 'date_histogram' && (
        <>
          <InlineField label="Interval" {...inlineFieldProps}>
            <Select
              onChange={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'interval', e.value!))}
              options={intervalOptions}
              // TODO: Not sure we have a better way of handling custom values
              defaultValue={selectDefaultValue(intervalOptions, bucketAgg.settings?.interval)}
              allowCustomValue
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              onBlur={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'min_doc_count', e.target.value!))}
              defaultValue={bucketAgg.settings?.min_doc_count ?? '0'}
            />
          </InlineField>

          <InlineField label="Trim Edges" {...inlineFieldProps} tooltip="Trim the edges on the timeseries datapoints">
            <Input
              onBlur={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'trimEdges', e.target.value!))}
              defaultValue={bucketAgg.settings?.trimEdges}
            />
          </InlineField>

          <InlineField
            label="Offset"
            {...inlineFieldProps}
            tooltip="Change the start value of each bucket by the specified positive (+) or negative offset (-) duration, such as 1h for an hour, or 1d for a day"
          >
            <Input
              onBlur={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'offset', e.target.value!))}
              defaultValue={bucketAgg.settings?.offset}
            />
          </InlineField>
        </>
      )}

      {bucketAgg.type === 'histogram' && (
        <>
          <InlineField label="Interval" {...inlineFieldProps}>
            <Select
              onChange={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'interval', e.value!))}
              options={intervalOptions}
              // TODO: Not sure we have a better way of handling custom values
              defaultValue={selectDefaultValue(intervalOptions, bucketAgg.settings?.interval)}
              allowCustomValue
            />
          </InlineField>

          <InlineField label="Min Doc Count" {...inlineFieldProps}>
            <Input
              onBlur={e => dispatch(changeBucketAggregationSetting(bucketAgg, 'min_doc_count', e.target.value!))}
              defaultValue={bucketAgg.settings?.min_doc_count ?? '0'}
            />
          </InlineField>
        </>
      )}

      {bucketAgg.type === 'filters' && <FiltersSettingsEditor value={bucketAgg} />}
    </SettingsEditorContainer>
  );
};
