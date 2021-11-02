import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { PureComponent } from 'react';
import { css, cx } from '@emotion/css';
import { Button, Container, Icon, IconButton, stylesFactory, ValuePicker } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { LayerActionID } from '../types';
import { canvasElementRegistry } from 'app/features/canvas';
import appEvents from 'app/core/app_events';
import { ElementState } from 'app/features/canvas/runtime/element';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
var LayerElementListEditor = /** @class */ (function (_super) {
    __extends(LayerElementListEditor, _super);
    function LayerElementListEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.style = getLayerDragStyles(config.theme);
        _this.onAddItem = function (sel) {
            var _a;
            var settings = _this.props.item.settings;
            if (!(settings === null || settings === void 0 ? void 0 : settings.layer)) {
                return;
            }
            var layer = settings.layer;
            var item = (_a = canvasElementRegistry.getIfExists(sel.value)) !== null && _a !== void 0 ? _a : notFoundItem;
            var newElementOptions = item.getNewOptions();
            newElementOptions.type = item.id;
            var newElement = new ElementState(item, newElementOptions, layer);
            newElement.updateSize(newElement.width, newElement.height);
            newElement.updateData(layer.scene.context);
            layer.elements.push(newElement);
            layer.scene.save();
            layer.reinitializeMoveable();
        };
        _this.onSelect = function (item) {
            var _a;
            var settings = _this.props.item.settings;
            if ((settings === null || settings === void 0 ? void 0 : settings.scene) && ((_a = settings === null || settings === void 0 ? void 0 : settings.scene) === null || _a === void 0 ? void 0 : _a.selecto)) {
                try {
                    settings.scene.selecto.clickTarget(item, item === null || item === void 0 ? void 0 : item.div);
                }
                catch (error) {
                    appEvents.emit(AppEvents.alertError, ['Unable to select element, try selecting element in panel instead']);
                }
            }
        };
        _this.onClearSelection = function () {
            var settings = _this.props.item.settings;
            if (!(settings === null || settings === void 0 ? void 0 : settings.layer)) {
                return;
            }
            var layer = settings.layer;
            layer.scene.clearCurrentSelection();
        };
        _this.getRowStyle = function (sel) {
            return sel ? _this.style.row + " " + _this.style.sel : _this.style.row;
        };
        _this.onDragEnd = function (result) {
            if (!result.destination) {
                return;
            }
            var settings = _this.props.item.settings;
            if (!(settings === null || settings === void 0 ? void 0 : settings.layer)) {
                return;
            }
            var layer = settings.layer;
            var count = layer.elements.length - 1;
            var src = (result.source.index - count) * -1;
            var dst = (result.destination.index - count) * -1;
            layer.reorder(src, dst);
        };
        return _this;
    }
    LayerElementListEditor.prototype.render = function () {
        var _this = this;
        var settings = this.props.item.settings;
        if (!settings) {
            return React.createElement("div", null, "No settings");
        }
        var layer = settings.layer;
        if (!layer) {
            return React.createElement("div", null, "Missing layer?");
        }
        var styles = this.style;
        var selection = settings.selected ? settings.selected.map(function (v) { return v.UID; }) : [];
        return (React.createElement(React.Fragment, null,
            React.createElement(DragDropContext, { onDragEnd: this.onDragEnd },
                React.createElement(Droppable, { droppableId: "droppable" }, function (provided, snapshot) { return (React.createElement("div", __assign({}, provided.droppableProps, { ref: provided.innerRef }),
                    (function () {
                        // reverse order
                        var rows = [];
                        var _loop_1 = function (i) {
                            var element = layer.elements[i];
                            rows.push(React.createElement(Draggable, { key: element.UID, draggableId: "" + element.UID, index: rows.length }, function (provided, snapshot) { return (React.createElement("div", __assign({ className: _this.getRowStyle(selection.includes(element.UID)), ref: provided.innerRef }, provided.draggableProps, provided.dragHandleProps, { onMouseDown: function () { return _this.onSelect(element); } }),
                                React.createElement("span", { className: styles.typeWrapper }, element.item.name),
                                React.createElement("div", { className: styles.textWrapper },
                                    "\u00A0 ",
                                    element.UID,
                                    " (",
                                    i,
                                    ")"),
                                React.createElement(IconButton, { name: "copy", title: 'Duplicate', className: styles.actionIcon, onClick: function () { return layer.doAction(LayerActionID.Duplicate, element); }, surface: "header" }),
                                React.createElement(IconButton, { name: "trash-alt", title: 'Remove', className: cx(styles.actionIcon, styles.dragIcon), onClick: function () { return layer.doAction(LayerActionID.Delete, element); }, surface: "header" }),
                                React.createElement(Icon, { title: "Drag and drop to reorder", name: "draggabledots", size: "lg", className: styles.dragIcon }))); }));
                        };
                        for (var i = layer.elements.length - 1; i >= 0; i--) {
                            _loop_1(i);
                        }
                        return rows;
                    })(),
                    provided.placeholder)); })),
            React.createElement("br", null),
            React.createElement(Container, null,
                React.createElement(ValuePicker, { icon: "plus", label: "Add item", variant: "secondary", options: canvasElementRegistry.selectOptions().options, onChange: this.onAddItem, isFullWidth: false }),
                selection.length > 0 && (React.createElement(Button, { size: "sm", variant: "secondary", onClick: this.onClearSelection }, "Clear Selection")))));
    };
    return LayerElementListEditor;
}(PureComponent));
export { LayerElementListEditor };
export var getLayerDragStyles = stylesFactory(function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing.md),
    row: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    padding: ", " ", ";\n    border-radius: ", ";\n    background: ", ";\n    min-height: ", "px;\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    margin-bottom: 3px;\n    cursor: pointer;\n\n    border: 1px solid ", ";\n    &:hover {\n      border: 1px solid ", ";\n    }\n  "], ["\n    padding: ", " ", ";\n    border-radius: ", ";\n    background: ", ";\n    min-height: ", "px;\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    margin-bottom: 3px;\n    cursor: pointer;\n\n    border: 1px solid ", ";\n    &:hover {\n      border: 1px solid ", ";\n    }\n  "])), theme.spacing.xs, theme.spacing.sm, theme.border.radius.sm, theme.colors.bg2, theme.spacing.formInputHeight, theme.colors.formInputBorder, theme.colors.formInputBorderHover),
    sel: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    border: 1px solid ", ";\n    &:hover {\n      border: 1px solid ", ";\n    }\n  "], ["\n    border: 1px solid ", ";\n    &:hover {\n      border: 1px solid ", ";\n    }\n  "])), theme.colors.formInputBorderActive, theme.colors.formInputBorderActive),
    dragIcon: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    cursor: drag;\n  "], ["\n    cursor: drag;\n  "]))),
    actionIcon: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    color: ", ";\n    &:hover {\n      color: ", ";\n    }\n  "], ["\n    color: ", ";\n    &:hover {\n      color: ", ";\n    }\n  "])), theme.colors.textWeak, theme.colors.text),
    typeWrapper: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    color: ", ";\n    margin-right: 5px;\n  "], ["\n    color: ", ";\n    margin-right: 5px;\n  "])), theme.colors.textBlue),
    textWrapper: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    display: flex;\n    align-items: center;\n    flex-grow: 1;\n    overflow: hidden;\n    margin-right: ", ";\n  "], ["\n    display: flex;\n    align-items: center;\n    flex-grow: 1;\n    overflow: hidden;\n    margin-right: ", ";\n  "])), theme.spacing.sm),
}); });
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;
//# sourceMappingURL=LayerElementListEditor.js.map