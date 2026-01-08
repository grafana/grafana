import { uniqueId } from 'lodash';
import { useCallback, useRef } from 'react';
import { GroupBase, OptionsOrGroups } from 'react-select';

import { InternalTimeZones, SelectableValue } from '@grafana/data';
import { InlineField, Input, Select, TimeZonePicker } from '@grafana/ui';
import { DateHistogram } from 'app/plugins/datasource/elasticsearch/dataquery.gen';

import { calendarIntervals } from '../../../../QueryBuilder';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { useCreatableSelectPersistedBehaviour } from '../../../hooks/useCreatableSelectPersistedBehaviour';
import { changeBucketAggregationSetting } from '../state/actions';
import { bucketAggregationConfig } from '../utils';

import { inlineFieldProps } from '.';

const defaultIntervalOptions: Array<SelectableValue<string>> = [
  { label: 'auto', value: 'auto' },
  { label: '10s', value: '10s' },
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '10m', value: '10m' },
  { label: '20m', value: '20m' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
  { label: '1w', value: '1w' },
  { label: '1M', value: '1M' },
  { label: '1q', value: '1q' },
  { label: '1y', value: '1y' },
];

const hasValue =
  (searchValue: string) =>
  ({ value }: SelectableValue<string>) =>
    value === searchValue;

const isValidNewOption = (
  inputValue: string,
  _: SelectableValue<string> | null,
  options: OptionsOrGroups<unknown, GroupBase<unknown>>
) => {
  // TODO: would be extremely nice here to allow only template variables and values that are
  // valid date histogram's Interval options
  const valueExists = (options as Array<SelectableValue<string>>).some(hasValue(inputValue));
  // we also don't want users to create "empty" values
  return !valueExists && inputValue.trim().length > 0;
};

const optionStartsWithValue = (option: SelectableValue<string>, value: string) =>
  option.value?.startsWith(value) || false;

interface Props {
  bucketAgg: DateHistogram;
}

const getIntervalType = (interval: string | undefined): 'calendar' | 'fixed' => {
  return interval && calendarIntervals.includes(interval) ? 'calendar' : 'fixed';
};

export const DateHistogramSettingsEditor = ({ bucketAgg }: Props) => {
  const dispatch = useDispatch();
  const { current: baseId } = useRef(uniqueId('es-date_histogram-'));

  const handleIntervalChange = useCallback(
    ({ value }: SelectableValue<string>) =>
      dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'interval', newValue: value })),
    [bucketAgg, dispatch]
  );

  const intervalType = getIntervalType(
    bucketAgg.settings?.interval || bucketAggregationConfig.date_histogram.defaultSettings?.interval
  );

  return (
    <>
      <InlineField
        label={intervalType === 'calendar' ? 'Calendar interval' : 'Fixed interval'}
        tooltip={
          intervalType === 'calendar'
            ? 'Calendar-aware intervals adapt to varying day lengths, month durations, and leap seconds, considering the calendar context.'
            : 'Fixed intervals remain constant, always being multiples of SI units, independent of calendar changes.'
        }
        {...inlineFieldProps}
      >
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
          id={`${baseId}-min_doc_count`}
          onBlur={(e) =>
            dispatch(
              changeBucketAggregationSetting({ bucketAgg, settingName: 'min_doc_count', newValue: e.target.value })
            )
          }
          defaultValue={
            bucketAgg.settings?.min_doc_count || bucketAggregationConfig.date_histogram.defaultSettings?.min_doc_count
          }
        />
      </InlineField>

      <InlineField label="Trim Edges" {...inlineFieldProps} tooltip="Trim the edges on the timeseries datapoints">
        <Input
          id={`${baseId}-trime_edges`}
          onBlur={(e) =>
            dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'trimEdges', newValue: e.target.value }))
          }
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
          id={`${baseId}-offset`}
          onBlur={(e) =>
            dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'offset', newValue: e.target.value }))
          }
          defaultValue={bucketAgg.settings?.offset || bucketAggregationConfig.date_histogram.defaultSettings?.offset}
        />
      </InlineField>

      <InlineField label="Timezone" {...inlineFieldProps}>
        <TimeZonePicker
          value={bucketAgg.settings?.timeZone || bucketAggregationConfig.date_histogram.defaultSettings?.timeZone}
          includeInternal={[InternalTimeZones.utc]}
          onChange={(timeZone) => {
            dispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'timeZone', newValue: timeZone }));
          }}
        />
      </InlineField>
    </>
  );
};
