import React, { useEffect } from 'react';
import { PluginState, TransformerCategory, } from '@grafana/data';
import { getDefaultOptions, getTransformerOptionPane } from '../spatial/optionsHelper';
import { addHeatmapCalculationOptions } from './editor/helper';
import { heatmapTransformer } from './heatmap';
// Nothing defined in state
const supplier = (builder, context) => {
    var _a;
    const options = (_a = context.options) !== null && _a !== void 0 ? _a : {};
    addHeatmapCalculationOptions('', builder, options);
};
export const HeatmapTransformerEditor = (props) => {
    useEffect(() => {
        var _a;
        if (!((_a = props.options.xBuckets) === null || _a === void 0 ? void 0 : _a.mode)) {
            const opts = getDefaultOptions(supplier);
            props.onChange(Object.assign(Object.assign({}, opts), props.options));
        }
    });
    // Shared with spatial transformer
    const pane = getTransformerOptionPane(props, supplier);
    return (React.createElement("div", null,
        React.createElement("div", null, pane.items.map((v) => v.render()))));
};
export const heatmapTransformRegistryItem = {
    id: heatmapTransformer.id,
    editor: HeatmapTransformerEditor,
    transformation: heatmapTransformer,
    name: heatmapTransformer.name,
    description: heatmapTransformer.description,
    state: PluginState.alpha,
    categories: new Set([TransformerCategory.CreateNewVisualization]),
};
//# sourceMappingURL=HeatmapTransformerEditor.js.map