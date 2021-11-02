import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { stylesFactory, useStyles2 } from '../../themes';
import { locale } from '@grafana/data';
var getStyles = stylesFactory(function (theme) {
    return {
        counter: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: counter;\n      margin-left: ", ";\n      border-radius: ", ";\n      background-color: ", ";\n      padding: ", ";\n      color: ", ";\n      font-weight: ", ";\n      font-size: ", ";\n    "], ["\n      label: counter;\n      margin-left: ", ";\n      border-radius: ", ";\n      background-color: ", ";\n      padding: ", ";\n      color: ", ";\n      font-weight: ", ";\n      font-size: ", ";\n    "])), theme.spacing(1), theme.spacing(3), theme.colors.action.hover, theme.spacing(0.25, 1), theme.colors.text.secondary, theme.typography.fontWeightMedium, theme.typography.size.sm),
    };
});
export var Counter = function (_a) {
    var value = _a.value;
    var styles = useStyles2(getStyles);
    return React.createElement("span", { className: styles.counter }, locale(value, 0).text);
};
var templateObject_1;
//# sourceMappingURL=Counter.js.map