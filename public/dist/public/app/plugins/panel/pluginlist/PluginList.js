import { __awaiter, __generator, __makeTemplateObject } from "tslib";
import React from 'react';
import { useAsync } from 'react-use';
import { css, cx } from '@emotion/css';
import { PluginType } from '@grafana/data';
import { CustomScrollbar, ModalsController, stylesFactory, Tooltip, useStyles } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { UpdatePluginModal } from './components/UpdatePluginModal';
export function PluginList(props) {
    var _this = this;
    var pluginState = useAsync(function () { return __awaiter(_this, void 0, void 0, function () {
        var plugins;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().get('api/plugins', { embedded: 0, core: 0 })];
                case 1:
                    plugins = _a.sent();
                    return [2 /*return*/, [
                            { header: 'Installed Apps', list: plugins.filter(function (p) { return p.type === PluginType.app; }), type: PluginType.app },
                            { header: 'Installed Panels', list: plugins.filter(function (p) { return p.type === PluginType.panel; }), type: PluginType.panel },
                            {
                                header: 'Installed Datasources',
                                list: plugins.filter(function (p) { return p.type === PluginType.datasource; }),
                                type: PluginType.datasource,
                            },
                        ]];
            }
        });
    }); }, []);
    var styles = useStyles(getStyles);
    var isAdmin = contextSrv.user.isGrafanaAdmin;
    if (pluginState.loading || pluginState.value === undefined) {
        return null;
    }
    return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" },
        React.createElement("div", { className: styles.pluginList }, pluginState.value.map(function (category) { return (React.createElement("div", { className: styles.section, key: "category-" + category.type },
            React.createElement("h6", { className: styles.sectionHeader }, category.header),
            category.list.map(function (plugin) { return (React.createElement("a", { className: styles.item, href: plugin.defaultNavUrl, key: "plugin-" + plugin.id },
                React.createElement("img", { src: plugin.info.logos.small, className: styles.image, width: "17", height: "17", alt: "" }),
                React.createElement("span", { className: styles.title }, plugin.name),
                React.createElement("span", { className: styles.version },
                    "v",
                    plugin.info.version),
                isAdmin &&
                    (plugin.hasUpdate ? (React.createElement(ModalsController, null, function (_a) {
                        var showModal = _a.showModal, hideModal = _a.hideModal;
                        return (React.createElement(Tooltip, { content: "New version: " + plugin.latestVersion, placement: "top" },
                            React.createElement("span", { className: cx(styles.message, styles.messageUpdate), onClick: function (e) {
                                    e.preventDefault();
                                    showModal(UpdatePluginModal, {
                                        pluginID: plugin.id,
                                        pluginName: plugin.name,
                                        onDismiss: hideModal,
                                        isOpen: true,
                                    });
                                } }, "Update available!")));
                    })) : plugin.enabled ? (React.createElement("span", { className: cx(styles.message, styles.messageNoUpdate) }, "Up to date")) : (React.createElement("span", { className: cx(styles.message, styles.messageEnable) }, "Enable now"))))); }),
            category.list.length === 0 && (React.createElement("a", { className: styles.item, href: "https://grafana.com/plugins" },
                React.createElement("span", { className: styles.noneInstalled },
                    "None installed. ",
                    React.createElement("em", { className: styles.emphasis }, "Browse Grafana.com")))))); }))));
}
var getStyles = stylesFactory(function (theme) { return ({
    pluginList: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: column;\n  "], ["\n    display: flex;\n    flex-direction: column;\n  "]))),
    section: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: column;\n    &:not(:last-of-type) {\n      margin-bottom: 16px;\n    }\n  "], ["\n    display: flex;\n    flex-direction: column;\n    &:not(:last-of-type) {\n      margin-bottom: 16px;\n    }\n  "]))),
    sectionHeader: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    color: ", ";\n    margin-bottom: ", ";\n  "], ["\n    color: ", ";\n    margin-bottom: ", ";\n  "])), theme.colors.textWeak, theme.spacing.d),
    image: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    width: 17px;\n    margin-right: ", ";\n  "], ["\n    width: 17px;\n    margin-right: ", ";\n  "])), theme.spacing.xxs),
    title: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    margin-right: calc(", " / 3);\n  "], ["\n    margin-right: calc(", " / 3);\n  "])), theme.spacing.d),
    version: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    font-size: ", ";\n    color: ", ";\n  "], ["\n    font-size: ", ";\n    color: ", ";\n  "])), theme.typography.size.sm, theme.colors.textWeak),
    item: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    display: flex;\n    justify-content: flex-start;\n    align-items: center;\n    cursor: pointer;\n    margin: ", ";\n    padding: ", ";\n    background: ", ";\n    border-radius: ", ";\n  "], ["\n    display: flex;\n    justify-content: flex-start;\n    align-items: center;\n    cursor: pointer;\n    margin: ", ";\n    padding: ", ";\n    background: ", ";\n    border-radius: ", ";\n  "])), theme.spacing.xxs, theme.spacing.sm, theme.colors.dashboardBg, theme.border.radius.md),
    message: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    margin-left: auto;\n    font-size: ", ";\n  "], ["\n    margin-left: auto;\n    font-size: ", ";\n  "])), theme.typography.size.sm),
    messageEnable: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    color: ", ";\n    &:hover {\n      border-bottom: ", " solid ", ";\n    }\n  "], ["\n    color: ", ";\n    &:hover {\n      border-bottom: ", " solid ", ";\n    }\n  "])), theme.colors.linkExternal, theme.border.width.sm, theme.colors.linkExternal),
    messageUpdate: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n    &:hover {\n      border-bottom: ", " solid ", ";\n    }\n  "], ["\n    &:hover {\n      border-bottom: ", " solid ", ";\n    }\n  "])), theme.border.width.sm, theme.colors.text),
    messageNoUpdate: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.textWeak),
    noneInstalled: css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n    color: ", ";\n    font-size: ", ";\n  "], ["\n    color: ", ";\n    font-size: ", ";\n  "])), theme.colors.textWeak, theme.typography.size.sm),
    emphasis: css(templateObject_13 || (templateObject_13 = __makeTemplateObject(["\n    font-weight: ", ";\n    font-style: normal;\n    color: ", ";\n  "], ["\n    font-weight: ", ";\n    font-style: normal;\n    color: ", ";\n  "])), theme.typography.weight.semibold, theme.colors.textWeak),
}); });
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13;
//# sourceMappingURL=PluginList.js.map