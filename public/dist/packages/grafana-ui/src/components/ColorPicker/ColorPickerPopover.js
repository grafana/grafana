import { __extends, __makeTemplateObject } from "tslib";
import React from 'react';
import { NamedColorsPalette } from './NamedColorsPalette';
import SpectrumPalette from './SpectrumPalette';
import { warnAboutColorPickerPropsDeprecation } from './warnAboutColorPickerPropsDeprecation';
import { css } from '@emotion/css';
import { colorManipulator } from '@grafana/data';
import { stylesFactory, withTheme2 } from '../../themes';
var UnThemedColorPickerPopover = /** @class */ (function (_super) {
    __extends(UnThemedColorPickerPopover, _super);
    function UnThemedColorPickerPopover(props) {
        var _this = _super.call(this, props) || this;
        _this.getTabClassName = function (tabName) {
            var activePicker = _this.state.activePicker;
            return "ColorPickerPopover__tab " + (activePicker === tabName && 'ColorPickerPopover__tab--active');
        };
        _this.handleChange = function (color) {
            var _a = _this.props, onColorChange = _a.onColorChange, onChange = _a.onChange, enableNamedColors = _a.enableNamedColors, theme = _a.theme;
            var changeHandler = onColorChange || onChange;
            if (enableNamedColors) {
                return changeHandler(color);
            }
            changeHandler(colorManipulator.asHexString(theme.visualization.getColorByName(color)));
        };
        _this.onTabChange = function (tab) {
            return function () { return _this.setState({ activePicker: tab }); };
        };
        _this.renderPicker = function () {
            var activePicker = _this.state.activePicker;
            var color = _this.props.color;
            switch (activePicker) {
                case 'spectrum':
                    return React.createElement(SpectrumPalette, { color: color, onChange: _this.handleChange });
                case 'palette':
                    return React.createElement(NamedColorsPalette, { color: color, onChange: _this.handleChange });
                default:
                    return _this.renderCustomPicker(activePicker);
            }
        };
        _this.renderCustomPicker = function (tabKey) {
            var _a = _this.props, customPickers = _a.customPickers, color = _a.color, theme = _a.theme;
            if (!customPickers) {
                return null;
            }
            return React.createElement(customPickers[tabKey].tabComponent, {
                color: color,
                theme: theme,
                onChange: _this.handleChange,
            });
        };
        _this.renderCustomPickerTabs = function () {
            var customPickers = _this.props.customPickers;
            if (!customPickers) {
                return null;
            }
            return (React.createElement(React.Fragment, null, Object.keys(customPickers).map(function (key) {
                return (React.createElement("div", { className: _this.getTabClassName(key), onClick: _this.onTabChange(key), key: key }, customPickers[key].name));
            })));
        };
        _this.state = {
            activePicker: 'palette',
        };
        warnAboutColorPickerPropsDeprecation('ColorPickerPopover', props);
        return _this;
    }
    UnThemedColorPickerPopover.prototype.render = function () {
        var theme = this.props.theme;
        var styles = getStyles(theme);
        return (React.createElement("div", { className: styles.colorPickerPopover },
            React.createElement("div", { className: styles.colorPickerPopoverTabs },
                React.createElement("div", { className: this.getTabClassName('palette'), onClick: this.onTabChange('palette') }, "Colors"),
                React.createElement("div", { className: this.getTabClassName('spectrum'), onClick: this.onTabChange('spectrum') }, "Custom"),
                this.renderCustomPickerTabs()),
            React.createElement("div", { className: styles.colorPickerPopoverContent }, this.renderPicker())));
    };
    return UnThemedColorPickerPopover;
}(React.Component));
export var ColorPickerPopover = withTheme2(UnThemedColorPickerPopover);
ColorPickerPopover.displayName = 'ColorPickerPopover';
var getStyles = stylesFactory(function (theme) {
    return {
        colorPickerPopover: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      border-radius: ", ";\n      box-shadow: ", ";\n      background: ", ";\n\n      .ColorPickerPopover__tab {\n        width: 50%;\n        text-align: center;\n        padding: ", ";\n        background: ", ";\n        color: ", ";\n        cursor: pointer;\n      }\n\n      .ColorPickerPopover__tab--active {\n        color: ", ";\n        font-weight: ", ";\n        background: ", ";\n      }\n    "], ["\n      border-radius: ", ";\n      box-shadow: ", ";\n      background: ", ";\n\n      .ColorPickerPopover__tab {\n        width: 50%;\n        text-align: center;\n        padding: ", ";\n        background: ", ";\n        color: ", ";\n        cursor: pointer;\n      }\n\n      .ColorPickerPopover__tab--active {\n        color: ", ";\n        font-weight: ", ";\n        background: ", ";\n      }\n    "])), theme.shape.borderRadius(), theme.shadows.z3, theme.colors.background.primary, theme.spacing(1, 0), theme.colors.background.secondary, theme.colors.text.secondary, theme.colors.text.primary, theme.typography.fontWeightMedium, theme.colors.background.primary),
        colorPickerPopoverContent: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: 336px;\n      font-size: ", ";\n      min-height: 184px;\n      padding: ", ";\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "], ["\n      width: 336px;\n      font-size: ", ";\n      min-height: 184px;\n      padding: ", ";\n      display: flex;\n      align-items: center;\n      justify-content: center;\n    "])), theme.typography.bodySmall.fontSize, theme.spacing(2)),
        colorPickerPopoverTabs: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      width: 100%;\n      border-radius: ", " ", " 0 0;\n      overflow: hidden;\n    "], ["\n      display: flex;\n      width: 100%;\n      border-radius: ", " ", " 0 0;\n      overflow: hidden;\n    "])), theme.shape.borderRadius(), theme.shape.borderRadius()),
    };
});
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=ColorPickerPopover.js.map