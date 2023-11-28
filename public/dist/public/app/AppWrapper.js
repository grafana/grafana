import { __awaiter } from "tslib";
import { KBarProvider } from 'kbar';
import React from 'react';
import { Provider } from 'react-redux';
import { Router, Redirect, Switch } from 'react-router-dom';
import { CompatRouter, CompatRoute } from 'react-router-dom-v5-compat';
import { config, locationService, navigationLogger, reportInteraction } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider, PortalContainer } from '@grafana/ui';
import { PerconaBootstrapper } from 'app/percona/shared/components/PerconaBootstrapper';
import { getAppRoutes } from 'app/routes/routes';
import { store } from 'app/store/store';
import { AngularRoot } from './angular/AngularRoot';
import { loadAndInitAngularIfEnabled } from './angular/loadAndInitAngularIfEnabled';
import { AppChrome } from './core/components/AppChrome/AppChrome';
import { AppNotificationList } from './core/components/AppNotifications/AppNotificationList';
import { GrafanaContext } from './core/context/GrafanaContext';
import { GrafanaRoute } from './core/navigation/GrafanaRoute';
import { contextSrv } from './core/services/context_srv';
import { ThemeProvider } from './core/utils/ConfigProvider';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';
import PerconaTourProvider from './percona/tour/TourProvider';
/** Used by enterprise */
let bodyRenderHooks = [];
let pageBanners = [];
export function addBodyRenderHook(fn) {
    bodyRenderHooks.push(fn);
}
export function addPageBanner(fn) {
    pageBanners.push(fn);
}
export class AppWrapper extends React.Component {
    constructor(props) {
        super(props);
        this.perconaReadyCallback = () => this.setState({ perconaReady: true });
        this.renderRoute = (route) => {
            const roles = route.roles ? route.roles() : [];
            return (React.createElement(CompatRoute, { exact: route.exact === undefined ? true : route.exact, sensitive: route.sensitive === undefined ? false : route.sensitive, path: route.path, key: route.path, render: (props) => {
                    // TODO[Router]: test this logic
                    if (roles === null || roles === void 0 ? void 0 : roles.length) {
                        if (!roles.some((r) => contextSrv.hasRole(r))) {
                            return React.createElement(Redirect, { to: "/" });
                        }
                    }
                    return React.createElement(GrafanaRoute, Object.assign({}, props, { route: route }));
                } }));
        };
        this.state = {};
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            yield loadAndInitAngularIfEnabled();
            this.setState({ ready: true });
            $('.preloader').remove();
        });
    }
    renderRoutes() {
        return React.createElement(Switch, null, getAppRoutes().map((r) => this.renderRoute(r)));
    }
    render() {
        const { app } = this.props;
        const { ready, perconaReady } = this.state;
        navigationLogger('AppWrapper', false, 'rendering');
        const commandPaletteActionSelected = (action) => {
            reportInteraction('command_palette_action_selected', {
                actionId: action.id,
                actionName: action.name,
            });
        };
        return (React.createElement(Provider, { store: store },
            React.createElement(ErrorBoundaryAlert, { style: "page" },
                React.createElement(GrafanaContext.Provider, { value: app.context },
                    React.createElement(ThemeProvider, { value: config.theme2 },
                        React.createElement(KBarProvider, { actions: [], options: { enableHistory: true, callbacks: { onSelectAction: commandPaletteActionSelected } } },
                            React.createElement(ModalsProvider, null,
                                React.createElement(GlobalStyles, null),
                                React.createElement("div", { className: "grafana-app" },
                                    React.createElement(Router, { history: locationService.getHistory() },
                                        React.createElement(CompatRouter, null,
                                            React.createElement(PerconaTourProvider, null,
                                                React.createElement(AppChrome, null,
                                                    ready && React.createElement(PerconaBootstrapper, { onReady: this.perconaReadyCallback }),
                                                    pageBanners.map((Banner, index) => (React.createElement(Banner, { key: index.toString() }))),
                                                    React.createElement(AngularRoot, null),
                                                    React.createElement(AppNotificationList, null),
                                                    ready && perconaReady && this.renderRoutes(),
                                                    bodyRenderHooks.map((Hook, index) => (React.createElement(Hook, { key: index.toString() })))))))),
                                React.createElement(LiveConnectionWarning, null),
                                React.createElement(ModalRoot, null),
                                React.createElement(PortalContainer, null))))))));
    }
}
//# sourceMappingURL=AppWrapper.js.map