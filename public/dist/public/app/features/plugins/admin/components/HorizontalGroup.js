import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
export var HorizontalGroup = function (_a) {
    var children = _a.children, wrap = _a.wrap, className = _a.className;
    var theme = useTheme2();
    var styles = getStyles(theme, wrap);
    return React.createElement("div", { className: cx(styles.container, className) }, children);
};
var getStyles = function (theme, wrap) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    flex-wrap: ", ";\n    & > * {\n      margin-bottom: ", ";\n      margin-right: ", ";\n    }\n    & > *:last-child {\n      margin-right: 0;\n    }\n  "], ["\n    display: flex;\n    flex-direction: row;\n    flex-wrap: ", ";\n    & > * {\n      margin-bottom: ", ";\n      margin-right: ", ";\n    }\n    & > *:last-child {\n      margin-right: 0;\n    }\n  "])), wrap ? 'wrap' : 'no-wrap', theme.spacing(), theme.spacing()),
}); };
var templateObject_1;
//# sourceMappingURL=HorizontalGroup.js.map