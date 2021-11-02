import { __makeTemplateObject } from "tslib";
import React from 'react';
import { isUnsignedPluginSignature, PluginState } from '@grafana/data';
import { IconButton, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { css, cx } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { PluginStateInfo } from 'app/features/plugins/PluginStateInfo';
export var PanelTypeCard = function (_a) {
    var _b;
    var isCurrent = _a.isCurrent, title = _a.title, plugin = _a.plugin, onClick = _a.onClick, onDelete = _a.onDelete, disabled = _a.disabled, showBadge = _a.showBadge, description = _a.description, children = _a.children;
    var styles = useStyles2(getStyles);
    var cssClass = cx((_b = {},
        _b[styles.item] = true,
        _b[styles.disabled] = disabled || plugin.state === PluginState.deprecated,
        _b[styles.current] = isCurrent,
        _b));
    return (React.createElement("div", { className: cssClass, "aria-label": selectors.components.PluginVisualization.item(plugin.name), onClick: disabled ? undefined : onClick, title: isCurrent ? 'Click again to close this section' : plugin.name },
        React.createElement("img", { className: styles.img, src: plugin.info.logos.small, alt: "" }),
        React.createElement("div", { className: styles.itemContent },
            React.createElement("div", { className: styles.name }, title),
            description ? React.createElement("span", { className: styles.description }, description) : null,
            children),
        showBadge && (React.createElement("div", { className: cx(styles.badge, disabled && styles.disabled) },
            React.createElement(PanelPluginBadge, { plugin: plugin }))),
        onDelete && (React.createElement(IconButton, { name: "trash-alt", onClick: function (e) {
                e.stopPropagation();
                onDelete();
            }, "aria-label": "Delete button on panel type card" }))));
};
PanelTypeCard.displayName = 'PanelTypeCard';
var getStyles = function (theme) {
    return {
        item: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: relative;\n      display: flex;\n      flex-shrink: 0;\n      cursor: pointer;\n      background: ", ";\n      border-radius: ", ";\n      box-shadow: ", ";\n      border: 1px solid ", ";\n      align-items: center;\n      padding: 8px;\n      width: 100%;\n      position: relative;\n      overflow: hidden;\n      transition: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "], ["\n      position: relative;\n      display: flex;\n      flex-shrink: 0;\n      cursor: pointer;\n      background: ", ";\n      border-radius: ", ";\n      box-shadow: ", ";\n      border: 1px solid ", ";\n      align-items: center;\n      padding: 8px;\n      width: 100%;\n      position: relative;\n      overflow: hidden;\n      transition: ", ";\n\n      &:hover {\n        background: ", ";\n      }\n    "])), theme.colors.background.secondary, theme.shape.borderRadius(), theme.shadows.z1, theme.colors.background.secondary, theme.transitions.create(['background'], {
            duration: theme.transitions.duration.short,
        }), theme.colors.emphasize(theme.colors.background.secondary, 0.03)),
        itemContent: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      position: relative;\n      width: 100%;\n      padding: ", ";\n    "], ["\n      position: relative;\n      width: 100%;\n      padding: ", ";\n    "])), theme.spacing(0, 1)),
        current: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: currentVisualizationItem;\n      border: 1px solid ", ";\n      background: ", ";\n    "], ["\n      label: currentVisualizationItem;\n      border: 1px solid ", ";\n      background: ", ";\n    "])), theme.colors.primary.border, theme.colors.action.selected),
        disabled: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      opacity: 0.2;\n      filter: grayscale(1);\n      cursor: default;\n      pointer-events: none;\n    "], ["\n      opacity: 0.2;\n      filter: grayscale(1);\n      cursor: default;\n      pointer-events: none;\n    "]))),
        name: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n      font-size: ", ";\n      font-weight: ", ";\n      width: 100%;\n    "], ["\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n      font-size: ", ";\n      font-weight: ", ";\n      width: 100%;\n    "])), theme.typography.size.sm, theme.typography.fontWeightMedium),
        description: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n      color: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      width: 100%;\n    "], ["\n      text-overflow: ellipsis;\n      overflow: hidden;\n      white-space: nowrap;\n      color: ", ";\n      font-size: ", ";\n      font-weight: ", ";\n      width: 100%;\n    "])), theme.colors.text.secondary, theme.typography.bodySmall.fontSize, theme.typography.fontWeightLight),
        img: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      max-height: 38px;\n      width: 38px;\n      display: flex;\n      align-items: center;\n    "], ["\n      max-height: 38px;\n      width: 38px;\n      display: flex;\n      align-items: center;\n    "]))),
        badge: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      background: ", ";\n    "], ["\n      background: ", ";\n    "])), theme.colors.background.primary),
    };
};
var PanelPluginBadge = function (_a) {
    var plugin = _a.plugin;
    if (isUnsignedPluginSignature(plugin.signature)) {
        return React.createElement(PluginSignatureBadge, { status: plugin.signature });
    }
    return React.createElement(PluginStateInfo, { state: plugin.state });
};
PanelPluginBadge.displayName = 'PanelPluginBadge';
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=PanelTypeCard.js.map