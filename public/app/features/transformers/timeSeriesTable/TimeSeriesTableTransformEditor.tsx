import React from 'react';

import { PluginState, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';

import { timeSeriesTableTransformer, TimeSeriesTableTransformerOptions } from './timeSeriesTableTransformer';

export interface Props extends TransformerUIProps<{}> {}

export function TimeSeriesTableTransformEditor({ input, options, onChange }: Props) {
  if (input.length === 0) {
    return null;
  }

  return <div></div>;
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
