import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Modal, useStyles2, VerticalGroup } from '@grafana/ui';
import { css } from '@emotion/css';
export function UpdatePluginModal(_a) {
    var onDismiss = _a.onDismiss, id = _a.id, name = _a.name;
    var styles = useStyles2(getStyles);
    return (React.createElement(Modal, { title: "Update Plugin", onDismiss: onDismiss, onClickBackdrop: onDismiss, isOpen: true },
        React.createElement(VerticalGroup, { spacing: "md" },
            React.createElement(VerticalGroup, { spacing: "sm" },
                React.createElement("p", null,
                    "Type the following on the command line to update ",
                    name,
                    "."),
                React.createElement("pre", null,
                    React.createElement("code", null,
                        "grafana-cli plugins update ",
                        id)),
                React.createElement("span", { className: styles.small },
                    "Check out ",
                    name,
                    " on ",
                    React.createElement("a", { href: "https://grafana.com/plugins/" + id }, "Grafana.com"),
                    " for README and changelog. If you do not have access to the command line, ask your Grafana administator.")),
            React.createElement("p", { className: styles.weak },
                React.createElement("img", { className: styles.logo, src: "public/img/grafana_icon.svg", alt: "grafana logo" }),
                React.createElement("strong", null, "Pro tip"),
                ": To update all plugins at once, type",
                ' ',
                React.createElement("code", { className: styles.codeSmall }, "grafana-cli plugins update-all"),
                " on the command line."))));
}
function getStyles(theme) {
    return {
        small: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      font-size: ", ";\n      font-weight: ", ";\n    "], ["\n      font-size: ", ";\n      font-weight: ", ";\n    "])), theme.typography.bodySmall.fontSize, theme.typography.bodySmall.fontWeight),
        weak: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      color: ", ";\n      font-size: ", ";\n    "], ["\n      color: ", ";\n      font-size: ", ";\n    "])), theme.colors.text.disabled, theme.typography.bodySmall.fontSize),
        logo: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      vertical-align: sub;\n      margin-right: ", ";\n      width: ", ";\n    "], ["\n      vertical-align: sub;\n      margin-right: ", ";\n      width: ", ";\n    "])), theme.spacing(0.3), theme.spacing(2)),
        codeSmall: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      white-space: nowrap;\n      margin: 0 ", ";\n      padding: ", ";\n    "], ["\n      white-space: nowrap;\n      margin: 0 ", ";\n      padding: ", ";\n    "])), theme.spacing(0.25), theme.spacing(0.25)),
    };
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=UpdatePluginModal.js.map