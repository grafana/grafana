import { __makeTemplateObject, __read } from "tslib";
import { useStyles } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import React from 'react';
import { AlertLabel } from './AlertLabel';
export var AlertLabels = function (_a) {
    var labels = _a.labels, className = _a.className;
    var styles = useStyles(getStyles);
    var pairs = Object.entries(labels).filter(function (_a) {
        var _b = __read(_a, 1), key = _b[0];
        return !(key.startsWith('__') && key.endsWith('__'));
    });
    return (React.createElement("div", { className: cx(styles.wrapper, className) }, pairs.map(function (_a, index) {
        var _b = __read(_a, 2), key = _b[0], value = _b[1];
        return (React.createElement(AlertLabel, { key: key + "-" + value + "-" + index, labelKey: key, value: value }));
    })));
};
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    & > * {\n      margin-bottom: ", ";\n      margin-right: ", ";\n    }\n    padding-bottom: ", ";\n  "], ["\n    & > * {\n      margin-bottom: ", ";\n      margin-right: ", ";\n    }\n    padding-bottom: ", ";\n  "])), theme.spacing.xs, theme.spacing.xs, theme.spacing.xs),
}); };
var templateObject_1;
//# sourceMappingURL=AlertLabels.js.map