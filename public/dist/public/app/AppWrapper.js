import { __assign, __extends } from "tslib";
import React from 'react';
import { Router, Route, Redirect, Switch } from 'react-router-dom';
import { config, locationService, navigationLogger } from '@grafana/runtime';
import { Provider } from 'react-redux';
import { store } from 'app/store/store';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider } from '@grafana/ui';
import { getAppRoutes } from 'app/routes/routes';
import { ConfigContext, ThemeProvider } from './core/utils/ConfigProvider';
import { contextSrv } from './core/services/context_srv';
import { NavBar } from './core/components/NavBar/NavBar';
import { GrafanaRoute } from './core/navigation/GrafanaRoute';
import { AppNotificationList } from './core/components/AppNotifications/AppNotificationList';
import { SearchWrapper } from 'app/features/search';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';
/** Used by enterprise */
var bodyRenderHooks = [];
var pageBanners = [];
export function addBodyRenderHook(fn) {
    bodyRenderHooks.push(fn);
}
export function addPageBanner(fn) {
    pageBanners.push(fn);
}
var AppWrapper = /** @class */ (function (_super) {
    __extends(AppWrapper, _super);
    function AppWrapper(props) {
        var _this = _super.call(this, props) || this;
        _this.container = React.createRef();
        _this.renderRoute = function (route) {
            var roles = route.roles ? route.roles() : [];
            return (React.createElement(Route, { exact: route.exact === undefined ? true : route.exact, path: route.path, key: route.path, render: function (props) {
                    navigationLogger('AppWrapper', false, 'Rendering route', route, 'with match', props.location);
                    // TODO[Router]: test this logic
                    if (roles === null || roles === void 0 ? void 0 : roles.length) {
                        if (!roles.some(function (r) { return contextSrv.hasRole(r); })) {
                            return React.createElement(Redirect, { to: "/" });
                        }
                    }
                    return React.createElement(GrafanaRoute, __assign({}, props, { route: route }));
                } }));
        };
        _this.state = {
            ngInjector: null,
        };
        return _this;
    }
    AppWrapper.prototype.componentDidMount = function () {
        if (this.container) {
            this.bootstrapNgApp();
        }
        else {
            throw new Error('Failed to boot angular app, no container to attach to');
        }
    };
    AppWrapper.prototype.bootstrapNgApp = function () {
        var injector = this.props.app.angularApp.bootstrap();
        this.setState({ ngInjector: injector });
    };
    AppWrapper.prototype.renderRoutes = function () {
        var _this = this;
        return React.createElement(Switch, null, getAppRoutes().map(function (r) { return _this.renderRoute(r); }));
    };
    AppWrapper.prototype.render = function () {
        navigationLogger('AppWrapper', false, 'rendering');
        // @ts-ignore
        var appSeed = "<grafana-app ng-cloak></app-notifications-list></grafana-app>";
        return (React.createElement(Provider, { store: store },
            React.createElement(ErrorBoundaryAlert, { style: "page" },
                React.createElement(ConfigContext.Provider, { value: config },
                    React.createElement(ThemeProvider, null,
                        React.createElement(ModalsProvider, null,
                            React.createElement(GlobalStyles, null),
                            React.createElement("div", { className: "grafana-app" },
                                React.createElement(Router, { history: locationService.getHistory() },
                                    React.createElement(NavBar, null),
                                    React.createElement("main", { className: "main-view" },
                                        pageBanners.map(function (Banner, index) { return (React.createElement(Banner, { key: index.toString() })); }),
                                        React.createElement("div", { id: "ngRoot", ref: this.container, dangerouslySetInnerHTML: {
                                                __html: appSeed,
                                            } }),
                                        React.createElement(AppNotificationList, null),
                                        React.createElement(SearchWrapper, null),
                                        this.state.ngInjector && this.container && this.renderRoutes(),
                                        bodyRenderHooks.map(function (Hook, index) { return (React.createElement(Hook, { key: index.toString() })); })))),
                            React.createElement(LiveConnectionWarning, null),
                            React.createElement(ModalRoot, null)))))));
    };
    return AppWrapper;
}(React.Component));
export { AppWrapper };
//# sourceMappingURL=AppWrapper.js.map