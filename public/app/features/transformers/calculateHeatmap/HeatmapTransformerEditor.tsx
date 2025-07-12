import { useEffect } from 'react';

import {
  PanelOptionsEditorBuilder,
  PluginState,
  StandardEditorContext,
  TransformerRegistryItem,
  TransformerUIProps,
  TransformerCategory,
} from '@grafana/data';

import { getTransformationContent } from '../docs/getTransformationContent';
import darkImage from '../images/dark/heatmap.svg';
import lightImage from '../images/light/heatmap.svg';
import { getDefaultOptions, getTransformerOptionPane } from '../spatial/optionsHelper';

import { addHeatmapCalculationOptions } from './editor/helper';
import { HeatmapTransformerOptions, getHeatmapTransformer } from './heatmap';

// Nothing defined in state
const supplier = (
  builder: PanelOptionsEditorBuilder<HeatmapTransformerOptions>,
  context: StandardEditorContext<HeatmapTransformerOptions>
) => {
  const options = context.options ?? {};

  addHeatmapCalculationOptions('', builder, options);
};

export const HeatmapTransformerEditor = (props: TransformerUIProps<HeatmapTransformerOptions>) => {
  useEffect(() => {
    if (!props.options.xBuckets?.mode) {
      const opts = getDefaultOptions(supplier);
      props.onChange({ ...opts, ...props.options });
    }
  });

  // Shared with spatial transformer
  const pane = getTransformerOptionPane<HeatmapTransformerOptions>(props, supplier);
  return (
    <div>
      <div>{pane.items.map((v) => v.render())}</div>
    </div>
  );
};

export const getHeatmapTransformRegistryItem: () => TransformerRegistryItem<HeatmapTransformerOptions> = () => {
  const heatmapTransformer = getHeatmapTransformer();
  return {
    id: heatmapTransformer.id,
    editor: HeatmapTransformerEditor,
    transformation: heatmapTransformer,
    name: heatmapTransformer.name,
    description: heatmapTransformer.description,
    state: PluginState.alpha,
    categories: new Set([TransformerCategory.CreateNewVisualization]),
    help: getTransformationContent(heatmapTransformer.id).helperDocs,
    imageDark: darkImage,
    imageLight: lightImage,
  };
};
