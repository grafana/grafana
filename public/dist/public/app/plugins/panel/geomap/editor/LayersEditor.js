import React from 'react';
import { Container } from '@grafana/ui';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { LayerDragDropList } from 'app/core/components/Layers/LayerDragDropList';
import { getLayersOptions } from '../layers/registry';
export const LayersEditor = (props) => {
    var _a, _b;
    const { layers, selected, actions } = (_a = props.context.instanceState) !== null && _a !== void 0 ? _a : {};
    if (!layers || !actions) {
        return React.createElement("div", null, "No layers?");
    }
    const onDragEnd = (result) => {
        var _a;
        if (!result.destination) {
            return;
        }
        const { layers, actions } = (_a = props.context.instanceState) !== null && _a !== void 0 ? _a : {};
        if (!layers || !actions) {
            return;
        }
        // account for the reverse order and offset (0 is baselayer)
        const count = layers.length - 1;
        const src = (result.source.index - count) * -1;
        const dst = (result.destination.index - count) * -1;
        actions.reorder(src, dst);
    };
    const onSelect = (element) => {
        actions.selectLayer(element.options.name);
    };
    const onDelete = (element) => {
        actions.deleteLayer(element.options.name);
    };
    const getLayerInfo = (element) => {
        return element.options.type;
    };
    const onNameChange = (element, name) => {
        element.onChange(Object.assign(Object.assign({}, element.options), { name }));
    };
    const selection = selected ? [(_b = layers[selected]) === null || _b === void 0 ? void 0 : _b.getName()] : [];
    return (React.createElement(React.Fragment, null,
        React.createElement(Container, null,
            React.createElement(AddLayerButton, { onChange: (v) => actions.addlayer(v.value), options: getLayersOptions(false).options, label: 'Add layer' })),
        React.createElement("br", null),
        React.createElement(LayerDragDropList, { layers: layers, showActions: () => layers.length > 2, getLayerInfo: getLayerInfo, onDragEnd: onDragEnd, onSelect: onSelect, onDelete: onDelete, selection: selection, excludeBaseLayer: true, onNameChange: onNameChange, verifyLayerNameUniqueness: actions.canRename })));
};
//# sourceMappingURL=LayersEditor.js.map