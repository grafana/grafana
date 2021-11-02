import { __assign, __awaiter, __extends, __generator, __makeTemplateObject, __values } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { capitalize, find } from 'lodash';
// Types
import { PluginIncludeType, PluginSignatureStatus, PluginSignatureType, PluginType, } from '@grafana/data';
import { AppNotificationSeverity } from 'app/types';
import { Alert, Badge, Icon, LinkButton, PluginSignatureBadge, Tooltip, useStyles2 } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { getPluginSettings } from './PluginSettingsCache';
import { importAppPlugin, importDataSourcePlugin } from './plugin_loader';
import { importPanelPluginFromMeta } from './importPanelPlugin';
import { getNotFoundNav } from 'app/core/nav_model_srv';
import { PluginHelp } from 'app/core/components/PluginHelp/PluginHelp';
import { AppConfigCtrlWrapper } from './wrappers/AppConfigWrapper';
import { PluginDashboards } from './PluginDashboards';
import { appEvents } from 'app/core/core';
import { config } from 'app/core/config';
import { contextSrv } from '../../core/services/context_srv';
import { css } from '@emotion/css';
import { selectors } from '@grafana/e2e-selectors';
import { ShowModalReactEvent } from 'app/types/events';
import { UpdatePluginModal } from './UpdatePluginModal';
var PAGE_ID_README = 'readme';
var PAGE_ID_DASHBOARDS = 'dashboards';
var PAGE_ID_CONFIG_CTRL = 'config';
var PluginPage = /** @class */ (function (_super) {
    __extends(PluginPage, _super);
    function PluginPage(props) {
        var _this = _super.call(this, props) || this;
        _this.showUpdateInfo = function () {
            var _a = _this.state.plugin.meta, id = _a.id, name = _a.name;
            appEvents.publish(new ShowModalReactEvent({
                props: {
                    id: id,
                    name: name,
                },
                component: UpdatePluginModal,
            }));
        };
        _this.state = {
            loading: true,
            nav: getLoadingNav(),
            defaultPage: PAGE_ID_README,
        };
        return _this;
    }
    PluginPage.prototype.componentDidMount = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, location_1, queryParams, appSubUrl, plugin, _b, defaultPage, nav, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        _a = this.props, location_1 = _a.location, queryParams = _a.queryParams;
                        appSubUrl = config.appSubUrl;
                        return [4 /*yield*/, loadPlugin(this.props.match.params.pluginId)];
                    case 1:
                        plugin = _d.sent();
                        _b = getPluginTabsNav(plugin, appSubUrl, location_1.pathname, queryParams, contextSrv.hasRole('Admin')), defaultPage = _b.defaultPage, nav = _b.nav;
                        this.setState({
                            loading: false,
                            plugin: plugin,
                            defaultPage: defaultPage,
                            nav: nav,
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        _c = _d.sent();
                        this.setState({
                            loading: false,
                            nav: getNotFoundNav(),
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    PluginPage.prototype.componentDidUpdate = function (prevProps) {
        var prevPage = prevProps.queryParams.page;
        var page = this.props.queryParams.page;
        if (prevPage !== page) {
            var _a = this.state, nav = _a.nav, defaultPage = _a.defaultPage;
            var node = __assign(__assign({}, nav.node), { children: setActivePage(page, nav.node.children, defaultPage) });
            this.setState({
                nav: {
                    node: node,
                    main: node,
                },
            });
        }
    };
    PluginPage.prototype.renderBody = function () {
        var e_1, _a;
        var queryParams = this.props.queryParams;
        var _b = this.state, plugin = _b.plugin, nav = _b.nav;
        if (!plugin) {
            return React.createElement(Alert, { severity: AppNotificationSeverity.Error, title: "Plugin Not Found" });
        }
        var active = nav.main.children.find(function (tab) { return tab.active; });
        if (active) {
            // Find the current config tab
            if (plugin.configPages) {
                try {
                    for (var _c = __values(plugin.configPages), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var tab = _d.value;
                        if (tab.id === active.id) {
                            return React.createElement(tab.body, { plugin: plugin, query: queryParams });
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            // Apps have some special behavior
            if (plugin.meta.type === PluginType.app) {
                if (active.id === PAGE_ID_DASHBOARDS) {
                    return React.createElement(PluginDashboards, { plugin: plugin.meta });
                }
                if (active.id === PAGE_ID_CONFIG_CTRL && plugin.angularConfigCtrl) {
                    return React.createElement(AppConfigCtrlWrapper, { app: plugin });
                }
            }
        }
        return React.createElement(PluginHelp, { plugin: plugin.meta, type: "help" });
    };
    PluginPage.prototype.renderVersionInfo = function (meta) {
        if (!meta.info.version) {
            return null;
        }
        return (React.createElement("section", { className: "page-sidebar-section" },
            React.createElement("h4", null, "Version"),
            React.createElement("span", null, meta.info.version),
            meta.hasUpdate && (React.createElement("div", null,
                React.createElement(Tooltip, { content: meta.latestVersion, theme: "info", placement: "top" },
                    React.createElement(LinkButton, { fill: "text", onClick: this.showUpdateInfo }, "Update Available!"))))));
    };
    PluginPage.prototype.renderSidebarIncludeBody = function (item) {
        var _a;
        if (item.type === PluginIncludeType.page) {
            var pluginId = this.state.plugin.meta.id;
            var page = item.name.toLowerCase().replace(' ', '-');
            var url = (_a = item.path) !== null && _a !== void 0 ? _a : "plugins/" + pluginId + "/page/" + page;
            return (React.createElement("a", { href: url },
                React.createElement("i", { className: getPluginIcon(item.type) }),
                item.name));
        }
        return (React.createElement(React.Fragment, null,
            React.createElement("i", { className: getPluginIcon(item.type) }),
            item.name));
    };
    PluginPage.prototype.renderSidebarIncludes = function (includes) {
        var _this = this;
        if (!includes || !includes.length) {
            return null;
        }
        return (React.createElement("section", { className: "page-sidebar-section" },
            React.createElement("h4", null, "Includes"),
            React.createElement("ul", { className: "ui-list plugin-info-list" }, includes.map(function (include) {
                return (React.createElement("li", { className: "plugin-info-list-item", key: include.name }, _this.renderSidebarIncludeBody(include)));
            }))));
    };
    PluginPage.prototype.renderSidebarDependencies = function (dependencies) {
        if (!dependencies) {
            return null;
        }
        return (React.createElement("section", { className: "page-sidebar-section" },
            React.createElement("h4", null, "Dependencies"),
            React.createElement("ul", { className: "ui-list plugin-info-list" },
                React.createElement("li", { className: "plugin-info-list-item" },
                    React.createElement("img", { src: "public/img/grafana_icon.svg", alt: "Grafana logo" }),
                    "Grafana ",
                    dependencies.grafanaVersion),
                dependencies.plugins &&
                    dependencies.plugins.map(function (plug) {
                        return (React.createElement("li", { className: "plugin-info-list-item", key: plug.name },
                            React.createElement("i", { className: getPluginIcon(plug.type) }),
                            plug.name,
                            " ",
                            plug.version));
                    }))));
    };
    PluginPage.prototype.renderSidebarLinks = function (info) {
        if (!info.links || !info.links.length) {
            return null;
        }
        return (React.createElement("section", { className: "page-sidebar-section" },
            React.createElement("h4", null, "Links"),
            React.createElement("ul", { className: "ui-list" }, info.links.map(function (link) {
                return (React.createElement("li", { key: link.url },
                    React.createElement("a", { href: link.url, className: "external-link", target: "_blank", rel: "noreferrer noopener" }, link.name)));
            }))));
    };
    PluginPage.prototype.renderPluginNotice = function () {
        var plugin = this.state.plugin;
        if (!plugin) {
            return null;
        }
        var isSignatureValid = plugin.meta.signature === PluginSignatureStatus.valid;
        if (plugin.meta.signature === PluginSignatureStatus.internal) {
            return null;
        }
        return (React.createElement(Alert, { "aria-label": selectors.pages.PluginPage.signatureInfo, severity: isSignatureValid ? 'info' : 'warning', title: "Plugin signature" },
            React.createElement("div", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            display: flex;\n          "], ["\n            display: flex;\n          "]))) },
                React.createElement(PluginSignatureBadge, { status: plugin.meta.signature, className: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n              margin-top: 0;\n            "], ["\n              margin-top: 0;\n            "]))) }),
                isSignatureValid && (React.createElement(PluginSignatureDetailsBadge, { signatureType: plugin.meta.signatureType, signatureOrg: plugin.meta.signatureOrg }))),
            React.createElement("br", null),
            React.createElement("p", null,
                "Grafana Labs checks each plugin to verify that it has a valid digital signature. Plugin signature verification is part of our security measures to ensure plugins are safe and trustworthy.",
                ' ',
                !isSignatureValid &&
                    'Grafana Labs can’t guarantee the integrity of this unsigned plugin. Ask the plugin author to request it to be signed.'),
            React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/", className: "external-link", target: "_blank", rel: "noreferrer" }, "Read more about plugins signing.")));
    };
    PluginPage.prototype.render = function () {
        var _a = this.state, loading = _a.loading, nav = _a.nav, plugin = _a.plugin;
        var isAdmin = contextSrv.hasRole('Admin');
        return (React.createElement(Page, { navModel: nav, "aria-label": selectors.pages.PluginPage.page },
            React.createElement(Page.Contents, { isLoading: loading }, plugin && (React.createElement("div", { className: "sidebar-container" },
                React.createElement("div", { className: "sidebar-content" },
                    plugin.loadError && (React.createElement(Alert, { severity: AppNotificationSeverity.Error, title: "Error Loading Plugin" },
                        React.createElement(React.Fragment, null,
                            "Check the server startup logs for more information. ",
                            React.createElement("br", null),
                            "If this plugin was loaded from git, make sure it was compiled."))),
                    this.renderPluginNotice(),
                    this.renderBody()),
                React.createElement("aside", { className: "page-sidebar" },
                    React.createElement("section", { className: "page-sidebar-section" },
                        this.renderVersionInfo(plugin.meta),
                        isAdmin && this.renderSidebarIncludes(plugin.meta.includes),
                        this.renderSidebarDependencies(plugin.meta.dependencies),
                        this.renderSidebarLinks(plugin.meta.info))))))));
    };
    return PluginPage;
}(PureComponent));
function getPluginTabsNav(plugin, appSubUrl, path, query, isAdmin) {
    var e_2, _a;
    var meta = plugin.meta;
    var defaultPage;
    var pages = [];
    pages.push({
        text: 'Readme',
        icon: 'file-alt',
        url: "" + appSubUrl + path + "?page=" + PAGE_ID_README,
        id: PAGE_ID_README,
    });
    // We allow non admins to see plugins but only their readme. Config is hidden
    // even though the API needs to be public for plugins to work properly.
    if (isAdmin) {
        // Only show Config/Pages for app
        if (meta.type === PluginType.app) {
            // Legacy App Config
            if (plugin.angularConfigCtrl) {
                pages.push({
                    text: 'Config',
                    icon: 'cog',
                    url: "" + appSubUrl + path + "?page=" + PAGE_ID_CONFIG_CTRL,
                    id: PAGE_ID_CONFIG_CTRL,
                });
                defaultPage = PAGE_ID_CONFIG_CTRL;
            }
            if (plugin.configPages) {
                try {
                    for (var _b = __values(plugin.configPages), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var page = _c.value;
                        pages.push({
                            text: page.title,
                            icon: page.icon,
                            url: "" + appSubUrl + path + "?page=" + page.id,
                            id: page.id,
                        });
                        if (!defaultPage) {
                            defaultPage = page.id;
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
            // Check for the dashboard pages
            if (find(meta.includes, { type: PluginIncludeType.dashboard })) {
                pages.push({
                    text: 'Dashboards',
                    icon: 'apps',
                    url: "" + appSubUrl + path + "?page=" + PAGE_ID_DASHBOARDS,
                    id: PAGE_ID_DASHBOARDS,
                });
            }
        }
    }
    if (!defaultPage) {
        defaultPage = pages[0].id; // the first tab
    }
    var node = {
        text: meta.name,
        img: meta.info.logos.large,
        subTitle: meta.info.author.name,
        breadcrumbs: [{ title: 'Plugins', url: 'plugins' }],
        url: "" + appSubUrl + path,
        children: setActivePage(query.page, pages, defaultPage),
    };
    return {
        defaultPage: defaultPage,
        nav: {
            node: node,
            main: node,
        },
    };
}
function setActivePage(pageId, pages, defaultPageId) {
    var found = false;
    var selected = pageId || defaultPageId;
    var changed = pages.map(function (p) {
        var active = !found && selected === p.id;
        if (active) {
            found = true;
        }
        return __assign(__assign({}, p), { active: active });
    });
    if (!found) {
        changed[0].active = true;
    }
    return changed;
}
function getPluginIcon(type) {
    switch (type) {
        case 'datasource':
            return 'gicon gicon-datasources';
        case 'panel':
            return 'icon-gf icon-gf-panel';
        case 'app':
            return 'icon-gf icon-gf-apps';
        case 'page':
            return 'icon-gf icon-gf-endpoint-tiny';
        case 'dashboard':
            return 'gicon gicon-dashboard';
        default:
            return 'icon-gf icon-gf-apps';
    }
}
export function getLoadingNav() {
    var node = {
        text: 'Loading...',
        icon: 'icon-gf icon-gf-panel',
    };
    return {
        node: node,
        main: node,
    };
}
export function loadPlugin(pluginId) {
    return __awaiter(this, void 0, void 0, function () {
        var info, result, panelPlugin;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getPluginSettings(pluginId)];
                case 1:
                    info = _a.sent();
                    if (!(info.type === PluginType.app)) return [3 /*break*/, 3];
                    return [4 /*yield*/, importAppPlugin(info)];
                case 2:
                    result = _a.sent();
                    _a.label = 3;
                case 3:
                    if (!(info.type === PluginType.datasource)) return [3 /*break*/, 5];
                    return [4 /*yield*/, importDataSourcePlugin(info)];
                case 4:
                    result = _a.sent();
                    _a.label = 5;
                case 5:
                    if (!(info.type === PluginType.panel)) return [3 /*break*/, 7];
                    return [4 /*yield*/, importPanelPluginFromMeta(info)];
                case 6:
                    panelPlugin = _a.sent();
                    result = panelPlugin;
                    _a.label = 7;
                case 7:
                    if (info.type === PluginType.renderer) {
                        result = { meta: info };
                    }
                    if (!result) {
                        throw new Error('Unknown Plugin type: ' + info.type);
                    }
                    return [2 /*return*/, result];
            }
        });
    });
}
var PluginSignatureDetailsBadge = function (_a) {
    var signatureType = _a.signatureType, signatureOrg = _a.signatureOrg;
    var styles = useStyles2(getDetailsBadgeStyles);
    if (!signatureType && !signatureOrg) {
        return null;
    }
    var signatureTypeIcon = signatureType === PluginSignatureType.grafana
        ? 'grafana'
        : signatureType === PluginSignatureType.commercial || signatureType === PluginSignatureType.community
            ? 'shield'
            : 'shield-exclamation';
    var signatureTypeText = signatureType === PluginSignatureType.grafana ? 'Grafana Labs' : capitalize(signatureType);
    return (React.createElement(React.Fragment, null,
        signatureType && (React.createElement(Badge, { color: "green", className: styles.badge, text: React.createElement(React.Fragment, null,
                React.createElement("strong", { className: styles.strong }, "Level:\u00A0"),
                React.createElement(Icon, { size: "xs", name: signatureTypeIcon }),
                "\u00A0",
                signatureTypeText) })),
        signatureOrg && (React.createElement(Badge, { color: "green", className: styles.badge, text: React.createElement(React.Fragment, null,
                React.createElement("strong", { className: styles.strong }, "Signed by:"),
                " ",
                signatureOrg) }))));
};
var getDetailsBadgeStyles = function (theme) { return ({
    badge: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    background-color: ", ";\n    border-color: ", ";\n    color: ", ";\n    margin-left: ", ";\n  "], ["\n    background-color: ", ";\n    border-color: ", ";\n    color: ", ";\n    margin-left: ", ";\n  "])), theme.colors.background.canvas, theme.colors.border.strong, theme.colors.text.secondary, theme.spacing()),
    strong: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.text.primary),
    icon: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing(0.5)),
}); };
export default PluginPage;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=PluginPage.js.map