import { __assign, __extends, __makeTemplateObject } from "tslib";
import React, { Component, createRef } from 'react';
import { PopoverController } from '../Tooltip/PopoverController';
import { Popover } from '../Tooltip/Popover';
import { ColorPickerPopover } from './ColorPickerPopover';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';
import { css } from '@emotion/css';
import { withTheme2, stylesFactory } from '../../themes';
import { ColorSwatch } from './ColorSwatch';
export var colorPickerFactory = function (popover, displayName) {
    var _a;
    if (displayName === void 0) { displayName = 'ColorPicker'; }
    return _a = /** @class */ (function (_super) {
            __extends(ColorPicker, _super);
            function ColorPicker() {
                var _this = _super !== null && _super.apply(this, arguments) || this;
                _this.pickerTriggerRef = createRef();
                _this.onColorChange = function (color) {
                    var _a = _this.props, onColorChange = _a.onColorChange, onChange = _a.onChange;
                    var changeHandler = (onColorChange || onChange);
                    return changeHandler(color);
                };
                return _this;
            }
            ColorPicker.prototype.render = function () {
                var _this = this;
                var _a = this.props, theme = _a.theme, children = _a.children;
                var styles = getStyles(theme);
                var popoverElement = React.createElement(popover, __assign(__assign({}, __assign(__assign({}, this.props), { children: null })), { onChange: this.onColorChange }));
                return (React.createElement(PopoverController, { content: popoverElement, hideAfter: 300 }, function (showPopper, hidePopper, popperProps) {
                    return (React.createElement(React.Fragment, null,
                        _this.pickerTriggerRef.current && (React.createElement(Popover, __assign({}, popperProps, { referenceElement: _this.pickerTriggerRef.current, wrapperClassName: styles.colorPicker, onMouseLeave: hidePopper, onMouseEnter: showPopper }))),
                        children ? (
                        // Children have a bit weird type due to intersection used in the definition so we need to cast here,
                        // but the definition is correct and should not allow to pass a children that does not conform to
                        // ColorPickerTriggerRenderer type.
                        children({
                            ref: _this.pickerTriggerRef,
                            showColorPicker: showPopper,
                            hideColorPicker: hidePopper,
                        })) : (React.createElement(ColorSwatch, { ref: _this.pickerTriggerRef, onClick: showPopper, onMouseLeave: hidePopper, color: theme.visualization.getColorByName(_this.props.color || '#000000') }))));
                }));
            };
            return ColorPicker;
        }(Component)),
        _a.displayName = displayName,
        _a;
};
export var ColorPicker = withTheme2(colorPickerFactory(ColorPickerPopover, 'ColorPicker'));
export var SeriesColorPicker = withTheme2(colorPickerFactory(SeriesColorPickerPopover, 'SeriesColorPicker'));
var getStyles = stylesFactory(function (theme) {
    return {
        colorPicker: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: absolute;\n      z-index: ", ";\n      color: ", ";\n      max-width: 400px;\n      font-size: ", ";\n      // !important because these styles are also provided to popper via .popper classes from Tooltip component\n      // hope to get rid of those soon\n      padding: 15px !important;\n      & [data-placement^='top'] {\n        padding-left: 0 !important;\n        padding-right: 0 !important;\n      }\n      & [data-placement^='bottom'] {\n        padding-left: 0 !important;\n        padding-right: 0 !important;\n      }\n      & [data-placement^='left'] {\n        padding-top: 0 !important;\n      }\n      & [data-placement^='right'] {\n        padding-top: 0 !important;\n      }\n    "], ["\n      position: absolute;\n      z-index: ", ";\n      color: ", ";\n      max-width: 400px;\n      font-size: ", ";\n      // !important because these styles are also provided to popper via .popper classes from Tooltip component\n      // hope to get rid of those soon\n      padding: 15px !important;\n      & [data-placement^='top'] {\n        padding-left: 0 !important;\n        padding-right: 0 !important;\n      }\n      & [data-placement^='bottom'] {\n        padding-left: 0 !important;\n        padding-right: 0 !important;\n      }\n      & [data-placement^='left'] {\n        padding-top: 0 !important;\n      }\n      & [data-placement^='right'] {\n        padding-top: 0 !important;\n      }\n    "])), theme.zIndex.tooltip, theme.colors.text.primary, theme.typography.size.sm),
    };
});
var templateObject_1;
//# sourceMappingURL=ColorPicker.js.map