import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { cx } from '@emotion/css';
import { Container, Icon, IconButton, ValuePicker } from '@grafana/ui';
import { config } from '@grafana/runtime';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { geomapLayerRegistry } from '../layers/registry';
import { getLayerDragStyles } from '../../canvas/editor/LayerElementListEditor';
import { dataLayerFilter } from './layerEditor';
var LayersEditor = /** @class */ (function (_super) {
    __extends(LayersEditor, _super);
    function LayersEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.style = getLayerDragStyles(config.theme);
        _this.getRowStyle = function (sel) {
            return sel ? _this.style.row + " " + _this.style.sel : _this.style.row;
        };
        _this.onDragEnd = function (result) {
            var _a;
            if (!result.destination) {
                return;
            }
            var _b = (_a = _this.props.context.instanceState) !== null && _a !== void 0 ? _a : {}, layers = _b.layers, actions = _b.actions;
            if (!layers || !actions) {
                return;
            }
            // account for the reverse order and offset (0 is baselayer)
            var count = layers.length - 1;
            var src = (result.source.index - count) * -1;
            var dst = (result.destination.index - count) * -1;
            actions.reorder(src, dst);
        };
        return _this;
    }
    LayersEditor.prototype.render = function () {
        var _this = this;
        var _a;
        var _b = (_a = this.props.context.instanceState) !== null && _a !== void 0 ? _a : {}, layers = _b.layers, selected = _b.selected, actions = _b.actions;
        if (!layers || !actions) {
            return React.createElement("div", null, "No layers?");
        }
        var baselayer = layers[0];
        var styles = this.style;
        return (React.createElement(React.Fragment, null,
            React.createElement(Container, null,
                React.createElement(ValuePicker, { icon: "plus", label: "Add layer", variant: "secondary", options: geomapLayerRegistry.selectOptions(undefined, dataLayerFilter).options, onChange: function (v) { return actions.addlayer(v.value); }, isFullWidth: true })),
            React.createElement("br", null),
            React.createElement(DragDropContext, { onDragEnd: this.onDragEnd },
                React.createElement(Droppable, { droppableId: "droppable" }, function (provided, snapshot) { return (React.createElement("div", __assign({}, provided.droppableProps, { ref: provided.innerRef }),
                    (function () {
                        // reverse order
                        var rows = [];
                        var _loop_1 = function (i) {
                            var element = layers[i];
                            rows.push(React.createElement(Draggable, { key: element.UID, draggableId: element.UID, index: rows.length }, function (provided, snapshot) {
                                var _a;
                                return (React.createElement("div", __assign({ className: _this.getRowStyle(i === selected), ref: provided.innerRef }, provided.draggableProps, provided.dragHandleProps, { onMouseDown: function () { return actions.selectLayer(element.UID); } }),
                                    React.createElement("span", { className: styles.typeWrapper }, element.options.type),
                                    React.createElement("div", { className: styles.textWrapper },
                                        "\u00A0 (", (_a = element.layer.getSourceState()) !== null && _a !== void 0 ? _a : '?',
                                        ")"),
                                    React.createElement(IconButton, { name: "trash-alt", title: 'remove', className: cx(styles.actionIcon, styles.dragIcon), onClick: function () { return actions.deleteLayer(element.UID); }, surface: "header" }),
                                    layers.length > 2 && (React.createElement(Icon, { title: "Drag and drop to reorder", name: "draggabledots", size: "lg", className: styles.dragIcon }))));
                            }));
                        };
                        for (var i = layers.length - 1; i > 0; i--) {
                            _loop_1(i);
                        }
                        return rows;
                    })(),
                    provided.placeholder)); })),
            false && baselayer && (React.createElement(React.Fragment, null,
                React.createElement("label", null, "Base layer"),
                React.createElement("div", { className: this.getRowStyle(false) },
                    React.createElement("span", { className: styles.typeWrapper }, baselayer.options.type),
                    React.createElement("div", { className: styles.textWrapper },
                        "\u00A0 ",
                        baselayer.UID))))));
    };
    return LayersEditor;
}(PureComponent));
export { LayersEditor };
//# sourceMappingURL=LayersEditor.js.map