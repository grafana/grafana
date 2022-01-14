import React from 'react';
import { DataTransformerID, PluginState, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';

import { HeatmapOptions, heatmapTransformer } from './heatmap';

export const HeatmapTransformerEditor: React.FC<TransformerUIProps<HeatmapOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return <div>TODO...</div>;
};

export const heatmapTransformRegistryItem: TransformerRegistryItem<HeatmapOptions> = {
  id: DataTransformerID.heatmap,
  editor: HeatmapTransformerEditor,
  transformation: heatmapTransformer,
  name: 'Create heatmap',
  description: 'calculate heatmap from source data',
  state: PluginState.alpha,
};
