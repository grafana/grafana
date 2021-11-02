import { __makeTemplateObject } from "tslib";
import React from 'react';
import { last } from 'lodash';
import { useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import { DiffTitle } from './DiffTitle';
import { DiffValues } from './DiffValues';
import { getDiffText } from './utils';
export var DiffGroup = function (_a) {
    var diffs = _a.diffs, title = _a.title;
    var styles = useStyles(getStyles);
    if (diffs.length === 1) {
        return (React.createElement("div", { className: styles.container, "data-testid": "diffGroup" },
            React.createElement(DiffTitle, { title: title, diff: diffs[0] })));
    }
    return (React.createElement("div", { className: styles.container, "data-testid": "diffGroup" },
        React.createElement(DiffTitle, { title: title }),
        React.createElement("ul", { className: styles.list }, diffs.map(function (diff, idx) {
            return (React.createElement("li", { className: styles.listItem, key: last(diff.path) + "__" + idx },
                React.createElement("span", null, getDiffText(diff)),
                " ",
                React.createElement(DiffValues, { diff: diff })));
        }))));
};
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    background-color: ", ";\n    font-size: ", ";\n    margin-bottom: ", ";\n    padding: ", ";\n  "], ["\n    background-color: ", ";\n    font-size: ", ";\n    margin-bottom: ", ";\n    padding: ", ";\n  "])), theme.colors.bg2, theme.typography.size.md, theme.spacing.md, theme.spacing.md),
    list: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-left: ", ";\n  "], ["\n    margin-left: ", ";\n  "])), theme.spacing.xl),
    listItem: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing.sm),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=DiffGroup.js.map