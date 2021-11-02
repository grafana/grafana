import { __makeTemplateObject } from "tslib";
import React, { memo } from 'react';
import { css } from '@emotion/css';
import { useTheme, stylesFactory } from '../../../themes';
var getStyle = stylesFactory(function (theme) {
    return {
        text: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-size: ", ";\n      font-weight: ", ";\n      color: ", ";\n      margin: 0;\n      display: flex;\n    "], ["\n      font-size: ", ";\n      font-weight: ", ";\n      color: ", ";\n      margin: 0;\n      display: flex;\n    "])), theme.typography.size.md, theme.typography.weight.semibold, theme.colors.formLabel),
    };
});
export var TimePickerTitle = memo(function (_a) {
    var children = _a.children;
    var theme = useTheme();
    var styles = getStyle(theme);
    return React.createElement("h3", { className: styles.text }, children);
});
TimePickerTitle.displayName = 'TimePickerTitle';
var templateObject_1;
//# sourceMappingURL=TimePickerTitle.js.map