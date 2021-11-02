import { __awaiter, __extends, __generator } from "tslib";
// Libraries
import React, { Component } from 'react';
import { AppEvents, PluginType } from '@grafana/data';
import { createHtmlPortalNode, InPortal, OutPortal } from 'react-reverse-portal';
import Page from 'app/core/components/Page/Page';
import { getPluginSettings } from './PluginSettingsCache';
import { importAppPlugin } from './plugin_loader';
import { getNotFoundNav, getWarningNav, getExceptionNav } from 'app/core/nav_model_srv';
import { appEvents } from 'app/core/core';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
export function getAppPluginPageError(meta) {
    if (!meta) {
        return 'Unknown Plugin';
    }
    if (meta.type !== PluginType.app) {
        return 'Plugin must be an app';
    }
    if (!meta.enabled) {
        return 'Application Not Enabled';
    }
    return null;
}
var AppRootPage = /** @class */ (function (_super) {
    __extends(AppRootPage, _super);
    function AppRootPage(props) {
        var _this = _super.call(this, props) || this;
        _this.onNavChanged = function (nav) {
            _this.setState({ nav: nav });
        };
        _this.state = {
            loading: true,
            portalNode: createHtmlPortalNode(),
        };
        return _this;
    }
    AppRootPage.prototype.shouldComponentUpdate = function (nextProps) {
        return nextProps.location.pathname.startsWith('/a/');
    };
    AppRootPage.prototype.loadPluginSettings = function () {
        return __awaiter(this, void 0, void 0, function () {
            var params, app, err_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        params = this.props.match.params;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, getPluginSettings(params.pluginId).then(function (info) {
                                var error = getAppPluginPageError(info);
                                if (error) {
                                    appEvents.emit(AppEvents.alertError, [error]);
                                    _this.setState({ nav: getWarningNav(error) });
                                    return null;
                                }
                                return importAppPlugin(info);
                            })];
                    case 2:
                        app = _a.sent();
                        this.setState({ plugin: app, loading: false, nav: undefined });
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        this.setState({
                            plugin: null,
                            loading: false,
                            nav: process.env.NODE_ENV === 'development' ? getExceptionNav(err_1) : getNotFoundNav(),
                        });
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    AppRootPage.prototype.componentDidMount = function () {
        this.loadPluginSettings();
    };
    AppRootPage.prototype.componentDidUpdate = function (prevProps) {
        var params = this.props.match.params;
        if (prevProps.match.params.pluginId !== params.pluginId) {
            this.setState({
                loading: true,
            });
            this.loadPluginSettings();
        }
    };
    AppRootPage.prototype.render = function () {
        var _a = this.state, loading = _a.loading, plugin = _a.plugin, nav = _a.nav, portalNode = _a.portalNode;
        if (plugin && !plugin.root) {
            // TODO? redirect to plugin page?
            return React.createElement("div", null, "No Root App");
        }
        return (React.createElement(React.Fragment, null,
            React.createElement(InPortal, { node: portalNode }, plugin && plugin.root && (React.createElement(plugin.root, { meta: plugin.meta, basename: this.props.match.url, onNavChanged: this.onNavChanged, query: this.props.queryParams, path: this.props.location.pathname }))),
            nav ? (React.createElement(Page, { navModel: nav },
                React.createElement(Page.Contents, { isLoading: loading },
                    React.createElement(OutPortal, { node: portalNode })))) : (React.createElement(Page, null,
                React.createElement(OutPortal, { node: portalNode }),
                loading && React.createElement(PageLoader, null)))));
    };
    return AppRootPage;
}(Component));
export default AppRootPage;
//# sourceMappingURL=AppRootPage.js.map