import React, { useCallback } from 'react';

import { PluginState, TransformerRegistryItem, TransformerUIProps, ReducerID } from '@grafana/data';
import { InlineFieldRow, InlineField, StatsPicker } from '@grafana/ui';

import { timeSeriesTableTransformer, TimeSeriesTableTransformerOptions } from './timeSeriesTableTransformer';

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

  const onSelectStat = useCallback(
    (refId: string, stats: string[]) => {
      if (stats.length) {
        onChange({
          refIdToStat: {
            ...options.refIdToStat,
            [refId]: stats[0] as ReducerID,
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
                <StatsPicker
                  stats={[options.refIdToStat?.[refId] ?? ReducerID.lastNotNull]}
                  onChange={onSelectStat.bind(null, refId)}
                />
              </InlineField>
            </InlineFieldRow>
          </div>
        );
      })}
    </>
  );
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
