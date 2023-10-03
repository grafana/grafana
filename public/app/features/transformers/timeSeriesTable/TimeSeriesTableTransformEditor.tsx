import React, { useCallback } from 'react';

import { PluginState, TransformerRegistryItem, TransformerUIProps, SelectableValue } from '@grafana/data';
import { InlineFieldRow, InlineField, Select } from '@grafana/ui';

import { timeSeriesTableTransformer, TimeSeriesTableTransformerOptions, ValueType } from './timeSeriesTableTransformer';

export function TimeSeriesTableTransformEditor({
  input,
  options,
  onChange,
}: TransformerUIProps<TimeSeriesTableTransformerOptions>) {
  const refIds: string[] = input.reduce<string[]>((acc, frame) => {
    if (frame.refId && !acc.includes(frame.refId)) {
      return [...acc, frame.refId];
    }
    return acc;
  }, []);

  const onSelectValueType = useCallback(
    (refId: string, value: SelectableValue<ValueType>) => {
      if (value.value) {
        onChange({
          refIdToValueType: {
            ...options.refIdToValueType,
            [refId]: value.value,
          },
        });
      }
    },
    [onChange, options]
  );

  return (
    <>
      {refIds.map((refId) => {
        return (
          <div key={refId}>
            <InlineFieldRow>
              <InlineField label={`Trend ${refIds.length > 1 ? ` #${refId}` : ''} value`}>
                <Select
                  options={valueTypeOptions}
                  value={options.refIdToValueType?.[refId] ?? ValueType.Last}
                  onChange={onSelectValueType.bind(undefined, refId)}
                />
              </InlineField>
            </InlineFieldRow>
          </div>
        );
      })}
    </>
  );
}

const valueTypeOptions: Array<SelectableValue<ValueType>> = [
  { value: ValueType.Last, label: 'Last' },
  { value: ValueType.Average, label: 'Average' },
  { value: ValueType.Median, label: 'Median' },
];

export const timeSeriesTableTransformRegistryItem: TransformerRegistryItem<TimeSeriesTableTransformerOptions> = {
  id: timeSeriesTableTransformer.id,
  editor: TimeSeriesTableTransformEditor,
  transformation: timeSeriesTableTransformer,
  name: timeSeriesTableTransformer.name,
  description: timeSeriesTableTransformer.description,
  state: PluginState.beta,
  help: ``,
};
