import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
var getStyles = function (theme) { return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  margin: 0;\n  margin-left: ", ";\n  font-size: ", ";\n  color: ", ";\n"], ["\n  margin: 0;\n  margin-left: ", ";\n  font-size: ", ";\n  color: ", ";\n"])), theme.spacing.md, theme.typography.size.sm, theme.colors.textWeak); };
export var DetailText = function (_a) {
    var children = _a.children;
    var collapsedTextStyles = useStyles(getStyles);
    return React.createElement("p", { className: collapsedTextStyles }, children);
};
var templateObject_1;
//# sourceMappingURL=DetailText.js.map