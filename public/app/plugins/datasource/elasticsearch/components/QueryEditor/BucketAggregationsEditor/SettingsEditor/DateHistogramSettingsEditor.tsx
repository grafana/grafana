import React, { ComponentProps } from 'react';
import { InlineField, Input, Select } from '@grafana/ui';
import { DateHistogram } from '../aggregations';
import { bucketAggregationConfig } from '../utils';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { SelectableValue } from '@grafana/data';
import { changeBucketAggregationSetting } from '../state/actions';
import { inlineFieldProps } from '.';
import { uniqueId } from 'lodash';
import { useCreatableSelectPersistedBehaviour } from '../../../hooks/useCreatableSelectPersistedBehaviour';

type IntervalOption = Required<Pick<SelectableValue<string>, 'label' | 'value'>>;

const defaultIntervalOptions: IntervalOption[] = [
  { label: 'auto', value: 'auto' },
  { label: '10s', value: '10s' },
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '10m', value: '10m' },
  { label: '20m', value: '20m' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
];

const hasValue = (searchValue: IntervalOption['value']) => ({ value }: IntervalOption) => value === searchValue;

const isValidNewOption: ComponentProps<typeof Select>['isValidNewOption'] = (
  inputValue,
  _,
  options: IntervalOption[]
) => {
  // TODO: would be extremely nice here to allow only template variables and values that are
  // valid date histogram's Interval options
  const valueExists = options.some(hasValue(inputValue));
  // we also don't want users to create "empty" values
  return !valueExists && inputValue.trim().length > 0;
};

const optionStartsWithValue: ComponentProps<typeof Select>['filterOption'] = (option: IntervalOption, value) =>
  option.value?.startsWith(value) || false;

interface Props {
  bucketAgg: DateHistogram;
}

export const DateHistogramSettingsEditor = ({ bucketAgg }: Props) => {
  const dispatch = useDispatch();

  const handleIntervalChange = (v: string) => dispatch(changeBucketAggregationSetting(bucketAgg, 'interval', v));

  return (
    <>
      <InlineField label="Interval" {...inlineFieldProps}>
        <Select
          inputId={uniqueId('es-date_histogram-interval')}
          isValidNewOption={isValidNewOption}
          filterOption={optionStartsWithValue}
          {...useCreatableSelectPersistedBehaviour({
            options: defaultIntervalOptions,
            value: bucketAgg.settings?.interval || bucketAggregationConfig.date_histogram.defaultSettings?.interval,
            onChange: handleIntervalChange,
          })}
        />
      </InlineField>

      <InlineField label="Min Doc Count" {...inlineFieldProps}>
        <Input
          onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'min_doc_count', e.target.value!))}
          defaultValue={
            bucketAgg.settings?.min_doc_count || bucketAggregationConfig.date_histogram.defaultSettings?.min_doc_count
          }
        />
      </InlineField>

      <InlineField label="Trim Edges" {...inlineFieldProps} tooltip="Trim the edges on the timeseries datapoints">
        <Input
          onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'trimEdges', e.target.value!))}
          defaultValue={
            bucketAgg.settings?.trimEdges || bucketAggregationConfig.date_histogram.defaultSettings?.trimEdges
          }
        />
      </InlineField>

      <InlineField
        label="Offset"
        {...inlineFieldProps}
        tooltip="Change the start value of each bucket by the specified positive (+) or negative offset (-) duration, such as 1h for an hour, or 1d for a day"
      >
        <Input
          onBlur={(e) => dispatch(changeBucketAggregationSetting(bucketAgg, 'offset', e.target.value!))}
          defaultValue={bucketAgg.settings?.offset || bucketAggregationConfig.date_histogram.defaultSettings?.offset}
        />
      </InlineField>
    </>
  );
};
