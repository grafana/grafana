import { Action, KBarProvider } from 'kbar';
import { Component, ComponentType } from 'react';
import { Provider } from 'react-redux';
import { Redirect, Switch, RouteComponentProps } from 'react-router-dom';
import { CompatRoute } from 'react-router-dom-v5-compat';

import { config, navigationLogger, reportInteraction } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, PortalContainer } from '@grafana/ui';
import { getAppRoutes } from 'app/routes/routes';
import { store } from 'app/store/store';

import { loadAndInitAngularIfEnabled } from './angular/loadAndInitAngularIfEnabled';
import { GrafanaApp } from './app';
import { GrafanaContext } from './core/context/GrafanaContext';
import { SidecarContext } from './core/context/SidecarContext';
import { GrafanaRoute } from './core/navigation/GrafanaRoute';
import { RouteDescriptor } from './core/navigation/types';
import { sidecarService } from './core/services/SidecarService';
import { contextSrv } from './core/services/context_srv';
import { ThemeProvider } from './core/utils/ConfigProvider';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';
import { ExperimentalSplitPaneRouterWrapper, RouterWrapper } from './routes/RoutesWrapper';

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

export class AppWrapper extends Component<AppWrapperProps, AppWrapperState> {
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
      <CompatRoute
        exact={route.exact === undefined ? true : route.exact}
        sensitive={route.sensitive === undefined ? false : route.sensitive}
        path={route.path}
        key={route.path}
        render={(props: RouteComponentProps) => {
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
    const { app } = this.props;
    const { ready } = this.state;

    navigationLogger('AppWrapper', false, 'rendering');

    const commandPaletteActionSelected = (action: Action) => {
      reportInteraction('command_palette_action_selected', {
        actionId: action.id,
        actionName: action.name,
      });
    };

    const routerWrapperProps = {
      routes: ready && this.renderRoutes(),
      pageBanners,
      bodyRenderHooks,
    };

    return (
      <Provider store={store}>
        <ErrorBoundaryAlert style="page">
          <GrafanaContext.Provider value={app.context}>
            <ThemeProvider value={config.theme2}>
              <KBarProvider
                actions={[]}
                options={{ enableHistory: true, callbacks: { onSelectAction: commandPaletteActionSelected } }}
              >
                <GlobalStyles />
                <SidecarContext.Provider value={sidecarService}>
                  <div className="grafana-app">
                    {config.featureToggles.appSidecar ? (
                      <ExperimentalSplitPaneRouterWrapper {...routerWrapperProps} />
                    ) : (
                      <RouterWrapper {...routerWrapperProps} />
                    )}
                    <LiveConnectionWarning />
                    <PortalContainer />
                  </div>
                </SidecarContext.Provider>
              </KBarProvider>
            </ThemeProvider>
          </GrafanaContext.Provider>
        </ErrorBoundaryAlert>
      </Provider>
    );
  }
}
