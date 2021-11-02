import { __makeTemplateObject } from "tslib";
import React from 'react';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { useTheme2, useStyles2 } from '../../themes';
import { css } from '@emotion/css';
import { ColorSwatch } from '../ColorPicker/ColorSwatch';
/**
 * @alpha
 * */
export var ColorValueEditor = function (_a) {
    var value = _a.value, onChange = _a.onChange;
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    return (React.createElement(ColorPicker, { color: value !== null && value !== void 0 ? value : '', onChange: onChange, enableNamedColors: true }, function (_a) {
        var ref = _a.ref, showColorPicker = _a.showColorPicker, hideColorPicker = _a.hideColorPicker;
        return (React.createElement("div", { className: styles.spot, onBlur: hideColorPicker },
            React.createElement("div", { className: styles.colorPicker },
                React.createElement(ColorSwatch, { ref: ref, onClick: showColorPicker, onMouseLeave: hideColorPicker, color: value ? theme.visualization.getColorByName(value) : theme.components.input.borderColor }))));
    }));
};
var getStyles = function (theme) {
    return {
        spot: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      color: ", ";\n      background: ", ";\n      padding: 3px;\n      height: ", "px;\n      border: 1px solid ", ";\n      display: flex;\n      flex-direction: row;\n      align-items: center;\n      &:hover {\n        border: 1px solid ", ";\n      }\n    "], ["\n      color: ", ";\n      background: ", ";\n      padding: 3px;\n      height: ", "px;\n      border: 1px solid ", ";\n      display: flex;\n      flex-direction: row;\n      align-items: center;\n      &:hover {\n        border: 1px solid ", ";\n      }\n    "])), theme.colors.text, theme.components.input.background, theme.v1.spacing.formInputHeight, theme.components.input.borderColor, theme.components.input.borderHover),
        colorPicker: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      padding: 0 ", ";\n    "], ["\n      padding: 0 ", ";\n    "])), theme.spacing(1)),
        colorText: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      cursor: pointer;\n      flex-grow: 1;\n    "], ["\n      cursor: pointer;\n      flex-grow: 1;\n    "]))),
        trashIcon: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      cursor: pointer;\n      color: ", ";\n      &:hover {\n        color: ", ";\n      }\n    "], ["\n      cursor: pointer;\n      color: ", ";\n      &:hover {\n        color: ", ";\n      }\n    "])), theme.colors.text.secondary, theme.colors.text),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=color.js.map