import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2, Icon, HorizontalGroup } from '@grafana/ui';
import { InstallControls } from './InstallControls';
import { PluginDetailsHeaderSignature } from './PluginDetailsHeaderSignature';
import { PluginDetailsHeaderDependencies } from './PluginDetailsHeaderDependencies';
import { PluginLogo } from './PluginLogo';
import { PluginDisabledBadge } from './Badges';
import { GetStartedWithPlugin } from './GetStartedWithPlugin';
export function PluginDetailsHeader(_a) {
    var _b;
    var plugin = _a.plugin, currentUrl = _a.currentUrl, parentUrl = _a.parentUrl;
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.headerContainer },
        React.createElement(PluginLogo, { alt: plugin.name + " logo", src: plugin.info.logos.small, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          object-fit: contain;\n          width: 100%;\n          height: 68px;\n          max-width: 68px;\n        "], ["\n          object-fit: contain;\n          width: 100%;\n          height: 68px;\n          max-width: 68px;\n        "]))) }),
        React.createElement("div", { className: styles.headerWrapper },
            React.createElement("nav", { className: styles.breadcrumb, "aria-label": "Breadcrumb" },
                React.createElement("ol", null,
                    React.createElement("li", null,
                        React.createElement("a", { className: styles.textUnderline, href: parentUrl }, "Plugins")),
                    React.createElement("li", null,
                        React.createElement("a", { href: currentUrl, "aria-current": "page" }, plugin.name)))),
            React.createElement("div", { className: styles.headerInformationRow },
                React.createElement("span", null, plugin.orgName), (_b = plugin.details) === null || _b === void 0 ? void 0 :
                _b.links.map(function (link) { return (React.createElement("a", { key: link.name, href: link.url }, link.name)); }),
                plugin.downloads > 0 && (React.createElement("span", null,
                    React.createElement(Icon, { name: "cloud-download" }), " " + new Intl.NumberFormat().format(plugin.downloads),
                    ' ')),
                plugin.version && React.createElement("span", null, plugin.version),
                React.createElement(PluginDetailsHeaderSignature, { plugin: plugin }),
                plugin.isDisabled && React.createElement(PluginDisabledBadge, { error: plugin.error })),
            React.createElement(PluginDetailsHeaderDependencies, { plugin: plugin, className: cx(styles.headerInformationRow, styles.headerInformationRowSecondary) }),
            React.createElement("p", null, plugin.description),
            React.createElement(HorizontalGroup, { height: "auto" },
                React.createElement(InstallControls, { plugin: plugin }),
                React.createElement(GetStartedWithPlugin, { plugin: plugin })))));
}
export var getStyles = function (theme) {
    return {
        headerContainer: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: flex;\n      margin-bottom: ", ";\n      margin-top: ", ";\n      min-height: 120px;\n    "], ["\n      display: flex;\n      margin-bottom: ", ";\n      margin-top: ", ";\n      min-height: 120px;\n    "])), theme.spacing(3), theme.spacing(3)),
        headerWrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-left: ", ";\n    "], ["\n      margin-left: ", ";\n    "])), theme.spacing(3)),
        breadcrumb: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      font-size: ", ";\n      li {\n        display: inline;\n        list-style: none;\n        &::after {\n          content: '/';\n          padding: 0 0.25ch;\n        }\n        &:last-child::after {\n          content: '';\n        }\n      }\n    "], ["\n      font-size: ", ";\n      li {\n        display: inline;\n        list-style: none;\n        &::after {\n          content: '/';\n          padding: 0 0.25ch;\n        }\n        &:last-child::after {\n          content: '';\n        }\n      }\n    "])), theme.typography.h2.fontSize),
        headerInformationRow: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      margin-top: ", ";\n      margin-bottom: ", ";\n      flex-flow: wrap;\n      & > * {\n        &::after {\n          content: '|';\n          padding: 0 ", ";\n        }\n        &:last-child::after {\n          content: '';\n          padding-right: 0;\n        }\n      }\n      font-size: ", ";\n    "], ["\n      display: flex;\n      align-items: center;\n      margin-top: ", ";\n      margin-bottom: ", ";\n      flex-flow: wrap;\n      & > * {\n        &::after {\n          content: '|';\n          padding: 0 ", ";\n        }\n        &:last-child::after {\n          content: '';\n          padding-right: 0;\n        }\n      }\n      font-size: ", ";\n    "])), theme.spacing(), theme.spacing(), theme.spacing(), theme.typography.h4.fontSize),
        headerInformationRowSecondary: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      font-size: ", ";\n    "], ["\n      font-size: ", ";\n    "])), theme.typography.body.fontSize),
        headerOrgName: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      font-size: ", ";\n    "], ["\n      font-size: ", ";\n    "])), theme.typography.h4.fontSize),
        signature: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      margin: ", ";\n      margin-bottom: 0;\n    "], ["\n      margin: ", ";\n      margin-bottom: 0;\n    "])), theme.spacing(3)),
        textUnderline: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      text-decoration: underline;\n    "], ["\n      text-decoration: underline;\n    "]))),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9;
//# sourceMappingURL=PluginDetailsHeader.js.map