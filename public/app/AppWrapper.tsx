import { Action, KBarProvider } from 'kbar';
import React, { ComponentType } from 'react';
import { Provider } from 'react-redux';
import { Router, Route, Redirect, Switch } from 'react-router-dom';

import { config, locationService, navigationLogger, reportInteraction } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider, PortalContainer } from '@grafana/ui';
import { SearchWrapper } from 'app/features/search';
import { getAppRoutes } from 'app/routes/routes';
import { store } from 'app/store/store';

import { AngularRoot } from './angular/AngularRoot';
import { loadAndInitAngularIfEnabled } from './angular/loadAndInitAngularIfEnabled';
import { GrafanaApp } from './app';
import { AppNotificationList } from './core/components/AppNotifications/AppNotificationList';
import { NavBar } from './core/components/NavBar/NavBar';
import { I18nProvider } from './core/localisation';
import { GrafanaRoute } from './core/navigation/GrafanaRoute';
import { RouteDescriptor } from './core/navigation/types';
import { contextSrv } from './core/services/context_srv';
import { ConfigContext, ThemeProvider } from './core/utils/ConfigProvider';
import { CommandPalette } from './features/commandPalette/CommandPalette';
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

  renderNavBar() {
    if (config.isPublicDashboardView || !this.state.ready || config.featureToggles.topnav) {
      return null;
    }

    return <NavBar />;
  }

  commandPaletteEnabled() {
    return config.featureToggles.commandPalette && !config.isPublicDashboardView;
  }

  searchBarEnabled() {
    return !config.isPublicDashboardView;
  }

  render() {
    const { ready } = this.state;

    navigationLogger('AppWrapper', false, 'rendering');

    const commandPaletteActionSelected = (action: Action) => {
      reportInteraction('commandPalette_action_selected', {
        actionId: action.id,
      });
    };

    return (
      <Provider store={store}>
        <I18nProvider>
          <ErrorBoundaryAlert style="page">
            <ConfigContext.Provider value={config}>
              <ThemeProvider>
                <KBarProvider
                  actions={[]}
                  options={{ enableHistory: true, callbacks: { onSelectAction: commandPaletteActionSelected } }}
                >
                  <ModalsProvider>
                    <GlobalStyles />
                    {this.commandPaletteEnabled() && <CommandPalette />}
                    <div className="grafana-app">
                      <Router history={locationService.getHistory()}>
                        {this.renderNavBar()}
                        <main className="main-view">
                          {pageBanners.map((Banner, index) => (
                            <Banner key={index.toString()} />
                          ))}

                          <AngularRoot />
                          <AppNotificationList />
                          {this.searchBarEnabled() && <SearchWrapper />}
                          {ready && this.renderRoutes()}
                          {bodyRenderHooks.map((Hook, index) => (
                            <Hook key={index.toString()} />
                          ))}
                        </main>
                      </Router>
                    </div>
                    <LiveConnectionWarning />
                    <ModalRoot />
                    <PortalContainer />
                  </ModalsProvider>
                </KBarProvider>
              </ThemeProvider>
            </ConfigContext.Provider>
          </ErrorBoundaryAlert>
        </I18nProvider>
      </Provider>
    );
  }
}
