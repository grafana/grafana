import { useEffect } from 'react';

import { type PanelOptionsEditorBuilder, type StandardEditorContext, type TransformerUIProps } from '@grafana/data';

import { getDefaultOptions, getTransformerOptionPane } from '../spatial/optionsHelper';

import { addHeatmapCalculationOptions } from './editor/helper';
import { type HeatmapTransformerOptions } from './heatmap';

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
      <div>{pane.items.map((v) => v.renderElement())}</div>
    </div>
  );
};
