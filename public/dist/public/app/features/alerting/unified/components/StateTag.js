import { __makeTemplateObject } from "tslib";
import { useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import React from 'react';
export var StateTag = function (_a) {
    var children = _a.children, state = _a.state;
    var styles = useStyles2(getStyles);
    return React.createElement("span", { className: cx(styles.common, styles[state]) }, children || state);
};
var getStyles = function (theme) { return ({
    common: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: inline-block;\n    color: white;\n    border-radius: ", ";\n    font-size: ", ";\n    padding: ", ";\n    text-transform: capitalize;\n    line-height: 1.2;\n    min-width: ", ";\n    text-align: center;\n    font-weight: ", ";\n  "], ["\n    display: inline-block;\n    color: white;\n    border-radius: ", ";\n    font-size: ", ";\n    padding: ", ";\n    text-transform: capitalize;\n    line-height: 1.2;\n    min-width: ", ";\n    text-align: center;\n    font-weight: ", ";\n  "])), theme.shape.borderRadius(), theme.typography.size.sm, theme.spacing(0.5, 1), theme.spacing(8), theme.typography.fontWeightBold),
    good: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "], ["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "])), theme.colors.success.main, theme.colors.success.main, theme.colors.success.contrastText),
    warning: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "], ["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "])), theme.colors.warning.main, theme.colors.warning.main, theme.colors.warning.contrastText),
    bad: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "], ["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "])), theme.colors.error.main, theme.colors.error.main, theme.colors.error.contrastText),
    neutral: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "], ["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "])), theme.colors.secondary.main, theme.colors.secondary.main, theme.colors.secondary.contrastText),
    info: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "], ["\n    background-color: ", ";\n    border: solid 1px ", ";\n    color: ", ";\n  "])), theme.colors.primary.main, theme.colors.primary.main, theme.colors.primary.contrastText),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=StateTag.js.map