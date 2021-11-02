import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Modal, stylesFactory, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
export function UpdatePluginModal(_a) {
    var pluginName = _a.pluginName, pluginID = _a.pluginID, onDismiss = _a.onDismiss;
    var styles = useStyles(getStyles);
    return (React.createElement(Modal, { title: "Update Plugin", icon: "cloud-download", onDismiss: onDismiss, isOpen: true },
        React.createElement("div", { className: styles.container },
            React.createElement("p", null,
                "Type the following on the command line to update ",
                pluginName,
                "."),
            React.createElement("pre", null,
                React.createElement("code", null,
                    "grafana-cli plugins update ",
                    pluginID)),
            React.createElement("span", { className: styles.small },
                "Check out ",
                pluginName,
                " on ",
                React.createElement("a", { href: "https://grafana.com/plugins/" + pluginID }, "Grafana.com"),
                " for README and changelog. If you do not have access to the command line, ask your Grafana administator.")),
        React.createElement("p", { className: styles.updateAllTip },
            React.createElement("img", { className: styles.inlineLogo, src: "public/img/grafana_icon.svg" }),
            React.createElement("strong", null, "Pro tip"),
            ": To update all plugins at once, type",
            ' ',
            React.createElement("code", { className: styles.codeSmall }, "grafana-cli plugins update-all"),
            " on the command line.")));
}
var getStyles = stylesFactory(function (theme) { return ({
    small: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    font-size: ", ";\n    font-weight: ", ";\n  "], ["\n    font-size: ", ";\n    font-weight: ", ";\n  "])), theme.typography.size.sm, theme.typography.weight.regular),
    codeSmall: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    font-size: ", ";\n    padding: ", ";\n    margin: 0 ", ";\n  "], ["\n    font-size: ", ";\n    padding: ", ";\n    margin: 0 ", ";\n  "])), theme.typography.size.xs, theme.spacing.xxs, theme.spacing.xxs),
    container: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-bottom: calc(", " * 2.5);\n  "], ["\n    margin-bottom: calc(", " * 2.5);\n  "])), theme.spacing.d),
    updateAllTip: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    color: ", ";\n    font-size: ", ";\n  "], ["\n    color: ", ";\n    font-size: ", ";\n  "])), theme.colors.textWeak, theme.typography.size.sm),
    inlineLogo: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    vertical-align: sub;\n    margin-right: calc(", " / 3);\n    width: ", ";\n  "], ["\n    vertical-align: sub;\n    margin-right: calc(", " / 3);\n    width: ", ";\n  "])), theme.spacing.d, theme.spacing.md),
}); });
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=UpdatePluginModal.js.map