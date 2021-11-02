import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { useTheme, stylesFactory } from '../../themes';
import { css, cx } from '@emotion/css';
export var getLegendStyles = stylesFactory(function (theme) {
    return {
        legend: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-size: ", ";\n      font-weight: ", ";\n      margin: 0 0 ", " 0;\n    "], ["\n      font-size: ", ";\n      font-weight: ", ";\n      margin: 0 0 ", " 0;\n    "])), theme.typography.heading.h3, theme.typography.weight.regular, theme.spacing.md),
    };
});
export var Legend = function (_a) {
    var children = _a.children, className = _a.className, legendProps = __rest(_a, ["children", "className"]);
    var theme = useTheme();
    var styles = getLegendStyles(theme);
    return (React.createElement("legend", __assign({ className: cx(styles.legend, className) }, legendProps), children));
};
var templateObject_1;
//# sourceMappingURL=Legend.js.map