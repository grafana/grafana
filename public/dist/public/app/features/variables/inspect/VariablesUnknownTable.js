import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Icon, Tooltip, useStyles } from '@grafana/ui';
import { VariablesUnknownButton } from './VariablesUnknownButton';
export var VariablesUnknownTable = function (_a) {
    var usages = _a.usages;
    var style = useStyles(getStyles);
    return (React.createElement("div", { className: style.container },
        React.createElement("h5", null,
            "Unknown Variables",
            React.createElement(Tooltip, { content: "This table lists all variable references that no longer exist in this dashboard." },
                React.createElement(Icon, { name: "info-circle", className: style.infoIcon }))),
        React.createElement("div", null,
            React.createElement("table", { className: "filter-table filter-table--hover" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Variable"),
                        React.createElement("th", { colSpan: 5 }))),
                React.createElement("tbody", null, usages.map(function (usage) {
                    var variable = usage.variable;
                    var id = variable.id, name = variable.name;
                    return (React.createElement("tr", { key: id },
                        React.createElement("td", { className: style.firstColumn },
                            React.createElement("span", null, name)),
                        React.createElement("td", { className: style.defaultColumn }),
                        React.createElement("td", { className: style.defaultColumn }),
                        React.createElement("td", { className: style.defaultColumn }),
                        React.createElement("td", { className: style.lastColumn },
                            React.createElement(VariablesUnknownButton, { id: variable.id, usages: usages }))));
                }))))));
};
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n    padding-top: ", ";\n    border-top: 1px solid ", ";\n  "], ["\n    margin-top: ", ";\n    padding-top: ", ";\n    border-top: 1px solid ", ";\n  "])), theme.spacing.xl, theme.spacing.xl, theme.colors.panelBorder),
    infoIcon: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-left: ", ";\n  "], ["\n    margin-left: ", ";\n  "])), theme.spacing.sm),
    defaultColumn: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: 1%;\n  "], ["\n    width: 1%;\n  "]))),
    firstColumn: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    width: 1%;\n    vertical-align: top;\n    color: ", ";\n  "], ["\n    width: 1%;\n    vertical-align: top;\n    color: ", ";\n  "])), theme.colors.textStrong),
    lastColumn: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    width: 100%;\n    text-align: right;\n  "], ["\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    width: 100%;\n    text-align: right;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=VariablesUnknownTable.js.map