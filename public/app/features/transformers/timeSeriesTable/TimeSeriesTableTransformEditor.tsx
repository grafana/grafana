import React, { useCallback } from 'react';

import { PluginState, TransformerRegistryItem, TransformerUIProps, ReducerID, isReducerID, SelectableValue, getFieldDisplayName } from '@grafana/data';
import { InlineFieldRow, InlineField, StatsPicker, InlineSwitch, Select } from '@grafana/ui';

import { timeSeriesTableTransformer, TimeSeriesTableTransformerOptions, getRefIds } from './timeSeriesTableTransformer';

export function TimeSeriesTableTransformEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<TimeSeriesTableTransformerOptions>) {
  const timeFields: Array<SelectableValue<string>> = [];
  const refIds: Set<string> = getRefIds(input)

  // Retrieve time fields
  for (const frame of input) {
    for (const field of frame.fields) {
      if (field.type === 'time') {
        const name = getFieldDisplayName(field, frame, input);
        timeFields.push({ label: name, value: name });
      }
    }
  }

  const onSelectTimefield = useCallback(
    (value: SelectableValue<string>) => {
      const val = value?.value !== undefined ? value.value : '';
      onChange({
        ...options,
        timeField: val,
      });
    }, 
    [onChange, options]
  );

  const onSelectStat = useCallback(
    (refId: string, stats: string[]) => {
      const reducerID = stats[0];
      if (reducerID && isReducerID(reducerID)) {
        onChange({
          refIdToStat: {
            ...options.refIdToStat,
            [refId]: reducerID,
          },
        });
      }
    },
    [onChange, options]
  );

  const onMergeSeriesToggle = useCallback(
    () => {
      // console.log(options);
      // onChange({
      //   ...options,
      //   mergeSeries: options.mergeSeries !== undefined ? !options.mergeSeries : false,
      // })
    },
    []// [onChange, options]
  );

  let configRows = [];
  for (const refId of refIds) {
    configRows.push(
      <InlineFieldRow key={refId}>
        <InlineField 
          label="Time Field" 
          tooltip="The the time field that will be used for the time series. If not selected the first found will be used.">
          <Select
            onChange={onSelectTimefield}
            options={timeFields}
            value={options[refId]?.timeField}
          />
        </InlineField>
        <InlineField 
          label="Stat"
          tooltip="The statistic that should be calculated for this time series.">
          <StatsPicker
            stats={[options[refId]?.stat ?? ReducerID.lastNotNull]}
            onChange={onSelectStat.bind(null, refId)}
            filterOptions={(ext) => ext.id !== ReducerID.allValues && ext.id !== ReducerID.uniqueValues}
          />
        </InlineField>
        <InlineField label="Merge series" tooltip="If selected, multiple series from a single datasource will be merged into one series.">
          <InlineSwitch 
            value={options[refId]?.mergeSeries !== undefined ? options[refId]?.mergeSeries : true}
            onChange={onMergeSeriesToggle}
          />
        </InlineField>
      </InlineFieldRow>
    );
  }

  return <>{configRows}</>;
}

export const timeSeriesTableTransformRegistryItem: TransformerRegistryItem<TimeSeriesTableTransformerOptions> = {
  id: timeSeriesTableTransformer.id,
  editor: TimeSeriesTableTransformEditor,
  transformation: timeSeriesTableTransformer,
  name: timeSeriesTableTransformer.name,
  description: timeSeriesTableTransformer.description,
  state: PluginState.beta,
  help: ``,
};
