import { __extends } from "tslib";
import React, { Component } from 'react';
import { ElementState } from 'app/features/canvas/runtime/element';
import { iconItem } from 'app/features/canvas/elements/icon';
import { getColorDimensionFromData, getResourceDimensionFromData, getScaleDimensionFromData, getTextDimensionFromData, } from 'app/features/dimensions';
var IconPanel = /** @class */ (function (_super) {
    __extends(IconPanel, _super);
    function IconPanel(props) {
        var _this = _super.call(this, props) || this;
        _this.initElement = function (props) {
            _this.element = new ElementState(iconItem, props.options.root);
            _this.updateSize(props);
            _this.element.updateData(_this.dims);
            return _this.element;
        };
        _this.updateSize = function (props) {
            var width = props.width, height = props.height;
            _this.element.anchor = {
                top: true,
                left: true,
            };
            _this.element.placement = {
                left: 0,
                top: 0,
                width: width,
                height: height,
            };
            _this.element.updateSize(width, height);
        };
        _this.dims = {
            getColor: function (color) { return getColorDimensionFromData(_this.props.data, color); },
            getScale: function (scale) { return getScaleDimensionFromData(_this.props.data, scale); },
            getText: function (text) { return getTextDimensionFromData(_this.props.data, text); },
            getResource: function (res) { return getResourceDimensionFromData(_this.props.data, res); },
        };
        _this.element = _this.initElement(props);
        return _this;
    }
    IconPanel.prototype.shouldComponentUpdate = function (nextProps) {
        var _a, _b;
        var _c = this.props, width = _c.width, height = _c.height, data = _c.data;
        var changed = false;
        if (width !== nextProps.width || height !== nextProps.height) {
            this.updateSize(nextProps);
            changed = true;
        }
        if (data !== nextProps.data) {
            this.element.updateData(this.dims);
            changed = true;
        }
        // Reload the element when options change
        if (((_a = this.props.options) === null || _a === void 0 ? void 0 : _a.root) !== ((_b = nextProps.options) === null || _b === void 0 ? void 0 : _b.root)) {
            this.initElement(nextProps);
            changed = true;
        }
        return changed;
    };
    IconPanel.prototype.render = function () {
        var _a = this.props, width = _a.width, height = _a.height;
        return React.createElement("div", { style: { width: width, height: height, overflow: 'hidden', position: 'relative' } }, this.element.render());
    };
    return IconPanel;
}(Component));
export { IconPanel };
//# sourceMappingURL=IconPanel.js.map