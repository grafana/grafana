import React, { ComponentType } from 'react';
import { Provider } from 'react-redux';
import { Router, Route, Redirect, Switch } from 'react-router-dom';

import { config, locationService, navigationLogger } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider } from '@grafana/ui';
import { SearchWrapper } from 'app/features/search';
import { getAppRoutes } from 'app/routes/routes';
import { store } from 'app/store/store';

import { AngularRoot } from './angular/AngularRoot';
import { loadAndInitAngularIfEnabled } from './angular/loadAndInitAngularIfEnabled';
import { GrafanaApp } from './app';
import { AppNotificationList } from './core/components/AppNotifications/AppNotificationList';
import { NavBar } from './core/components/NavBar/NavBar';
import { NavBarNext } from './core/components/NavBar/Next/NavBarNext';
import { I18nProvider } from './core/localisation';
import { GrafanaRoute } from './core/navigation/GrafanaRoute';
import { RouteDescriptor } from './core/navigation/types';
import { contextSrv } from './core/services/context_srv';
import { ConfigContext, ThemeProvider } from './core/utils/ConfigProvider';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';

interface AppWrapperProps {
  app: GrafanaApp;
}

interface AppWrapperState {
  ready?: boolean;
}

/** Used by enterprise */
let bodyRenderHooks: ComponentType[] = [];
let pageBanners: ComponentType[] = [];

export function addBodyRenderHook(fn: ComponentType) {
  bodyRenderHooks.push(fn);
}

export function addPageBanner(fn: ComponentType) {
  pageBanners.push(fn);
}

export class AppWrapper extends React.Component<AppWrapperProps, AppWrapperState> {
  constructor(props: AppWrapperProps) {
    super(props);
    this.state = {};
  }

  async componentDidMount() {
    await loadAndInitAngularIfEnabled();
    this.setState({ ready: true });
    $('.preloader').remove();
  }

  renderRoute = (route: RouteDescriptor) => {
    const roles = route.roles ? route.roles() : [];

    return (
      <Route
        exact={route.exact === undefined ? true : route.exact}
        path={route.path}
        key={route.path}
        render={(props) => {
          navigationLogger('AppWrapper', false, 'Rendering route', route, 'with match', props.location);
          // TODO[Router]: test this logic
          if (roles?.length) {
            if (!roles.some((r: string) => contextSrv.hasRole(r))) {
              return <Redirect to="/" />;
            }
          }

          return <GrafanaRoute {...props} route={route} />;
        }}
      />
    );
  };

  renderRoutes() {
    return <Switch>{getAppRoutes().map((r) => this.renderRoute(r))}</Switch>;
  }

  render() {
    const { ready } = this.state;

    navigationLogger('AppWrapper', false, 'rendering');

    const newNavigationEnabled = Boolean(config.featureToggles.newNavigation);

    return (
      <Provider store={store}>
        <I18nProvider>
          <ErrorBoundaryAlert style="page">
            <ConfigContext.Provider value={config}>
              <ThemeProvider>
                <ModalsProvider>
                  <GlobalStyles />
                  <div className="grafana-app">
                    <Router history={locationService.getHistory()}>
                      {ready && <>{newNavigationEnabled ? <NavBarNext /> : <NavBar />}</>}
                      <main className="main-view">
                        {pageBanners.map((Banner, index) => (
                          <Banner key={index.toString()} />
                        ))}

                        <AngularRoot />
                        <AppNotificationList />
                        <SearchWrapper />
                        {ready && this.renderRoutes()}
                        {bodyRenderHooks.map((Hook, index) => (
                          <Hook key={index.toString()} />
                        ))}
                      </main>
                    </Router>
                  </div>
                  <LiveConnectionWarning />
                  <ModalRoot />
                </ModalsProvider>
              </ThemeProvider>
            </ConfigContext.Provider>
          </ErrorBoundaryAlert>
        </I18nProvider>
      </Provider>
    );
  }
}
