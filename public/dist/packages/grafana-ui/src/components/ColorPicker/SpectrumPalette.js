import { __makeTemplateObject, __read } from "tslib";
import React, { useMemo, useState } from 'react';
import { RgbaStringColorPicker } from 'react-colorful';
import tinycolor from 'tinycolor2';
import ColorInput from './ColorInput';
import { colorManipulator } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '../../themes';
import { useThrottleFn } from 'react-use';
var SpectrumPalette = function (_a) {
    var color = _a.color, onChange = _a.onChange;
    var _b = __read(useState(color), 2), currentColor = _b[0], setColor = _b[1];
    useThrottleFn(function (c) {
        onChange(colorManipulator.asHexString(theme.visualization.getColorByName(c)));
    }, 500, [currentColor]);
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    var rgbaString = useMemo(function () {
        return currentColor.startsWith('rgba')
            ? currentColor
            : tinycolor(theme.visualization.getColorByName(color)).toRgbString();
    }, [currentColor, theme, color]);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(RgbaStringColorPicker, { className: cx(styles.root), color: rgbaString, onChange: setColor }),
        React.createElement(ColorInput, { theme: theme, color: rgbaString, onChange: setColor, className: styles.colorInput })));
};
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    flex-grow: 1;\n  "], ["\n    flex-grow: 1;\n  "]))),
    root: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    &.react-colorful {\n      width: auto;\n    }\n\n    .react-colorful {\n      &__saturation {\n        border-radius: ", " ", " 0 0;\n      }\n      &__alpha {\n        border-radius: 0 0 ", " ", ";\n      }\n      &__alpha,\n      &__hue {\n        height: ", ";\n        position: relative;\n      }\n      &__pointer {\n        height: ", ";\n        width: ", ";\n      }\n    }\n  "], ["\n    &.react-colorful {\n      width: auto;\n    }\n\n    .react-colorful {\n      &__saturation {\n        border-radius: ", " ", " 0 0;\n      }\n      &__alpha {\n        border-radius: 0 0 ", " ", ";\n      }\n      &__alpha,\n      &__hue {\n        height: ", ";\n        position: relative;\n      }\n      &__pointer {\n        height: ", ";\n        width: ", ";\n      }\n    }\n  "])), theme.v1.border.radius.sm, theme.v1.border.radius.sm, theme.v1.border.radius.sm, theme.v1.border.radius.sm, theme.spacing(2), theme.spacing(2), theme.spacing(2)),
    colorInput: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(2)),
}); };
export default SpectrumPalette;
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=SpectrumPalette.js.map