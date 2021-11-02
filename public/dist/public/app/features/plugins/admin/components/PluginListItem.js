import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { PluginIconName, PluginListDisplayMode, PluginTabIds } from '../types';
import { PluginListItemBadges } from './PluginListItemBadges';
import { PluginLogo } from './PluginLogo';
import { Icon, useStyles2 } from '@grafana/ui';
export var LOGO_SIZE = '48px';
export function PluginListItem(_a) {
    var _b;
    var plugin = _a.plugin, pathName = _a.pathName, _c = _a.displayMode, displayMode = _c === void 0 ? PluginListDisplayMode.Grid : _c;
    var styles = useStyles2(getStyles);
    var isList = displayMode === PluginListDisplayMode.List;
    return (React.createElement("a", { href: pathName + "/" + plugin.id + "?page=" + PluginTabIds.OVERVIEW, className: cx(styles.container, (_b = {}, _b[styles.list] = isList, _b)) },
        React.createElement(PluginLogo, { src: plugin.info.logos.small, className: styles.pluginLogo, height: LOGO_SIZE, alt: "" }),
        React.createElement("h2", { className: cx(styles.name, 'plugin-name') }, plugin.name),
        React.createElement("div", { className: cx(styles.content, 'plugin-content') },
            React.createElement("p", null,
                "By ",
                plugin.orgName),
            React.createElement(PluginListItemBadges, { plugin: plugin })),
        React.createElement("div", { className: styles.pluginType }, plugin.type && React.createElement(Icon, { name: PluginIconName[plugin.type], title: plugin.type + " plugin" }))));
}
// Styles shared between the different type of list items
export var getStyles = function (theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: grid;\n      grid-template-columns: ", " 1fr ", ";\n      grid-template-rows: auto;\n      gap: ", ";\n      grid-auto-flow: row;\n      background: ", ";\n      border-radius: ", ";\n      padding: ", ";\n      transition: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      display: grid;\n      grid-template-columns: ", " 1fr ", ";\n      grid-template-rows: auto;\n      gap: ", ";\n      grid-auto-flow: row;\n      background: ", ";\n      border-radius: ", ";\n      padding: ", ";\n      transition: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "])), LOGO_SIZE, theme.spacing(3), theme.spacing(2), theme.colors.background.secondary, theme.shape.borderRadius(), theme.spacing(3), theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
            duration: theme.transitions.duration.short,
        }), theme.colors.emphasize(theme.colors.background.secondary, 0.03)),
        list: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      row-gap: 0px;\n\n      > img {\n        align-self: start;\n      }\n\n      > .plugin-content {\n        min-height: 0px;\n        grid-area: 2 / 2 / 4 / 3;\n\n        > p {\n          margin: ", ";\n        }\n      }\n\n      > .plugin-name {\n        align-self: center;\n        grid-area: 1 / 2 / 2 / 3;\n      }\n    "], ["\n      row-gap: 0px;\n\n      > img {\n        align-self: start;\n      }\n\n      > .plugin-content {\n        min-height: 0px;\n        grid-area: 2 / 2 / 4 / 3;\n\n        > p {\n          margin: ", ";\n        }\n      }\n\n      > .plugin-name {\n        align-self: center;\n        grid-area: 1 / 2 / 2 / 3;\n      }\n    "])), theme.spacing(0, 0, 0.5, 0)),
        pluginType: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      grid-area: 1 / 3 / 2 / 4;\n      color: ", ";\n    "], ["\n      grid-area: 1 / 3 / 2 / 4;\n      color: ", ";\n    "])), theme.colors.text.secondary),
        pluginLogo: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      grid-area: 1 / 1 / 3 / 2;\n      max-width: 100%;\n      align-self: center;\n      object-fit: contain;\n    "], ["\n      grid-area: 1 / 1 / 3 / 2;\n      max-width: 100%;\n      align-self: center;\n      object-fit: contain;\n    "]))),
        content: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      grid-area: 3 / 1 / 4 / 3;\n      color: ", ";\n    "], ["\n      grid-area: 3 / 1 / 4 / 3;\n      color: ", ";\n    "])), theme.colors.text.secondary),
        name: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      grid-area: 1 / 2 / 3 / 3;\n      align-self: center;\n      font-size: ", ";\n      color: ", ";\n      margin: 0;\n    "], ["\n      grid-area: 1 / 2 / 3 / 3;\n      align-self: center;\n      font-size: ", ";\n      color: ", ";\n      margin: 0;\n    "])), theme.typography.h4.fontSize, theme.colors.text.primary),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
//# sourceMappingURL=PluginListItem.js.map