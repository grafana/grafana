import { __makeTemplateObject } from "tslib";
import React from 'react';
import { useStyles, Icon } from '@grafana/ui';
import { css } from '@emotion/css';
import { getDiffText } from './utils';
import { DiffValues } from './DiffValues';
var replaceDiff = { op: 'replace', originalValue: undefined, path: [''], value: undefined, startLineNumber: 0 };
export var DiffTitle = function (_a) {
    var diff = _a.diff, title = _a.title;
    var styles = useStyles(getDiffTitleStyles);
    return diff ? (React.createElement(React.Fragment, null,
        React.createElement(Icon, { type: "mono", name: "circle", className: styles[diff.op] }),
        " ",
        React.createElement("span", { className: styles.embolden }, title),
        ' ',
        React.createElement("span", null, getDiffText(diff, diff.path.length > 1)),
        " ",
        React.createElement(DiffValues, { diff: diff }))) : (React.createElement("div", { className: styles.withoutDiff },
        React.createElement(Icon, { type: "mono", name: "circle", className: styles.replace }),
        " ",
        React.createElement("span", { className: styles.embolden }, title),
        ' ',
        React.createElement("span", null, getDiffText(replaceDiff, false))));
};
var getDiffTitleStyles = function (theme) { return ({
    embolden: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    font-weight: ", ";\n  "], ["\n    font-weight: ", ";\n  "])), theme.typography.weight.bold),
    add: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.online),
    replace: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.warn),
    move: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.warn),
    copy: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.warn),
    _get: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.warn),
    test: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.warn),
    remove: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.palette.critical),
    withoutDiff: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing.md),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=DiffTitle.js.map