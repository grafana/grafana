import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useStyles } from '@grafana/ui';
import { cx, css } from '@emotion/css';
export var Well = function (_a) {
    var children = _a.children, className = _a.className;
    var styles = useStyles(getStyles);
    return React.createElement("div", { className: cx(styles.wrapper, className) }, children);
};
export var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    background-color: ", ";\n    border: solid 1px ", ";\n    border-radius: ", ";\n    padding: ", " ", ";\n    font-family: ", ";\n  "], ["\n    background-color: ", ";\n    border: solid 1px ", ";\n    border-radius: ", ";\n    padding: ", " ", ";\n    font-family: ", ";\n  "])), theme.colors.panelBg, theme.colors.formInputBorder, theme.border.radius.sm, theme.spacing.xs, theme.spacing.sm, theme.typography.fontFamily.monospace),
}); };
var templateObject_1;
//# sourceMappingURL=Well.js.map