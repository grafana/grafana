import React from 'react';
import { PluginState, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';

import { HeatmapTransformerOptions, heatmapTransformer } from './heatmap';

export const HeatmapTransformerEditor: React.FC<TransformerUIProps<HeatmapTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return <div>TODO...</div>;
};

export const heatmapTransformRegistryItem: TransformerRegistryItem<HeatmapTransformerOptions> = {
  id: heatmapTransformer.id,
  editor: HeatmapTransformerEditor,
  transformation: heatmapTransformer,
  name: heatmapTransformer.name,
  description: heatmapTransformer.description,
  state: PluginState.alpha,
};
