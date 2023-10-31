import React, { useCallback } from 'react';

import {
  PluginState,
  TransformerRegistryItem,
  TransformerUIProps,
  ReducerID,
  isReducerID,
  SelectableValue,
  getFieldDisplayName,
} from '@grafana/data';
import { InlineFieldRow, InlineField, StatsPicker, Select, InlineLabel } from '@grafana/ui';

import {
  timeSeriesTableTransformer,
  TimeSeriesTableTransformerOptions,
  getRefData,
} from './timeSeriesTableTransformer';

export function TimeSeriesTableTransformEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<TimeSeriesTableTransformerOptions>) {
  const refIdMap = getRefData(input);

  const onSelectTimefield = useCallback(
    (refId: string, value: SelectableValue<string>) => {
      const val = value?.value !== undefined ? value.value : '';
      onChange({
        ...options,
        [refId]: {
          ...options[refId],
          timeField: val,
        },
      });
    },
    [onChange, options]
  );

  const onSelectStat = useCallback(
    (refId: string, stats: string[]) => {
      const reducerID = stats[0];
      if (reducerID && isReducerID(reducerID)) {
        onChange({
          ...options,
          [refId]: {
            ...options[refId],
            stat: reducerID,
          },
        });
      }
    },
    [onChange, options]
  );

  let configRows = [];
  for (const refId of Object.keys(refIdMap)) {
    // Get time fields for the current refId
    const timeFields: Array<SelectableValue<string>> = [];
    for (const frame of input) {
      if (frame.refId === refId) {
        for (const field of frame.fields) {
          if (field.type === 'time') {
            const name = getFieldDisplayName(field, frame, input);
            timeFields.push({ label: name, value: name });
          }
        }
      }
    }

    configRows.push(
      <InlineFieldRow key={refId}>
        <InlineField>
          <InlineLabel>{`Trend #${refId}`}</InlineLabel>
        </InlineField>
        <InlineField
          label="Time field"
          tooltip="The time field that will be used for the time series. If not selected the first found will be used."
        >
          <Select
            onChange={onSelectTimefield.bind(null, refId)}
            options={timeFields}
            value={options[refId]?.timeField}
          />
        </InlineField>
        <InlineField label="Stat" tooltip="The statistic that should be calculated for this time series.">
          <StatsPicker
            stats={[options[refId]?.stat ?? ReducerID.lastNotNull]}
            onChange={onSelectStat.bind(null, refId)}
            filterOptions={(ext) => ext.id !== ReducerID.allValues && ext.id !== ReducerID.uniqueValues}
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
