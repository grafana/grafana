import React from 'react';
import { DataTransformerID, PluginState, TransformerRegistryItem, TransformerUIProps } from '@grafana/data';

import { HeatmapTransformerOptions, heatmapTransformer } from './heatmap';

export const HeatmapTransformerEditor: React.FC<TransformerUIProps<HeatmapTransformerOptions>> = ({
  input,
  options,
  onChange,
}) => {
  return <div>TODO...</div>;
};

export const heatmapTransformRegistryItem: TransformerRegistryItem<HeatmapTransformerOptions> = {
  id: DataTransformerID.heatmap,
  editor: HeatmapTransformerEditor,
  transformation: heatmapTransformer,
  name: 'Calculate heatmap',
  description: 'create a heatmap from source data',
  state: PluginState.alpha,
};
