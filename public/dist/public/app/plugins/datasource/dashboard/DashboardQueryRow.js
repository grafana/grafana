import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { Icon, useStyles } from '@grafana/ui';
export function DashboardQueryRow(_a) {
    var editURL = _a.editURL, target = _a.target;
    var style = useStyles(getStyles);
    return (React.createElement("div", { className: style.queryEditorRowHeader },
        React.createElement("div", null,
            React.createElement("img", { src: target.img, width: 16, className: style.logo }),
            React.createElement("span", null, target.refId + ":")),
        React.createElement("div", null,
            React.createElement("a", { href: editURL },
                target.query,
                "\u00A0",
                React.createElement(Icon, { name: "external-link-alt" })))));
}
function getStyles(theme) {
    return {
        logo: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: logo;\n      margin-right: ", ";\n    "], ["\n      label: logo;\n      margin-right: ", ";\n    "])), theme.spacing.sm),
        queryEditorRowHeader: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: queryEditorRowHeader;\n      display: flex;\n      padding: 4px 8px;\n      flex-flow: row wrap;\n      background: ", ";\n      align-items: center;\n    "], ["\n      label: queryEditorRowHeader;\n      display: flex;\n      padding: 4px 8px;\n      flex-flow: row wrap;\n      background: ", ";\n      align-items: center;\n    "])), theme.colors.bg2),
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=DashboardQueryRow.js.map