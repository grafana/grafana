import { useCallback } from 'react';

import {
  PluginState,
  TransformerRegistryItem,
  TransformerUIProps,
  ReducerID,
  isReducerID,
  SelectableValue,
  Field,
  FieldType,
  isTimeSeriesField,
} from '@grafana/data';
import { InlineFieldRow, InlineField, StatsPicker, Select, InlineLabel } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { getTransformationContent } from '../docs/getTransformationContent';

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
    const timeFields: Record<string, Field<FieldType.time>> = {};
    const timeValues: Array<SelectableValue<string>> = [];

    // Get a map of time fields, we map
    // by field name and assume that time fields
    // in the same query with the same name
    // are the same
    for (const frame of input) {
      if (frame.refId === refId) {
        for (const field of frame.fields) {
          if (isTimeSeriesField(field)) {
            timeFields[field.name] = field;
          }
        }
      }
    }

    for (const timeField of Object.values(timeFields)) {
      const { name } = timeField;
      timeValues.push({ label: name, value: name });
    }

    configRows.push(
      <InlineFieldRow key={refId}>
        <InlineField>
          <InlineLabel>{`Trend #${refId}`}</InlineLabel>
        </InlineField>
        <InlineField
          label={t('transformers.time-series-table-transform-editor.label-time-field', 'Time field')}
          tooltip={t(
            'transformers.time-series-table-transform-editor.tooltip-time-field',
            'The time field that will be used for the time series. If not selected the first found will be used.'
          )}
        >
          <Select
            onChange={onSelectTimefield.bind(null, refId)}
            options={timeValues}
            value={options[refId]?.timeField}
            isClearable={true}
          />
        </InlineField>
        <InlineField
          label={t('transformers.time-series-table-transform-editor.label-stat', 'Stat')}
          tooltip={t(
            'transformers.time-series-table-transform-editor.tooltip-statistic-should-calculated-series',
            'The statistic that should be calculated for this time series.'
          )}
        >
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
  help: getTransformationContent(timeSeriesTableTransformer.id).helperDocs,
};
