import React, { ComponentType } from 'react';
import { Router, Route, Redirect, Switch } from 'react-router-dom';
import { css } from '@emotion/css';
import { config, locationService, navigationLogger } from '@grafana/runtime';
import { Provider } from 'react-redux';
import { store } from 'app/store/store';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider } from '@grafana/ui';
import { GrafanaApp } from './app';
import { getAppRoutes } from 'app/routes/routes';
import { ConfigContext, ThemeProvider } from './core/utils/ConfigProvider';
import { RouteDescriptor } from './core/navigation/types';
import { contextSrv } from './core/services/context_srv';
import { SideMenu } from './core/components/sidemenu/SideMenu';
import { GrafanaRoute } from './core/navigation/GrafanaRoute';
import { AppNotificationList } from './core/components/AppNotifications/AppNotificationList';
import { SearchWrapper } from 'app/features/search';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';

const getFlexDirection = (navPosition: typeof contextSrv.user.navPosition) => {
  switch (navPosition) {
    case 'left': {
      return 'row';
    }
    case 'right': {
      return 'row-reverse';
    }
    case 'top': {
      return 'column';
    }
    case 'bottom': {
      return 'column-reverse';
    }
    default: {
      return 'row';
    }
  }
};

interface AppWrapperProps {
  app: GrafanaApp;
}

interface AppWrapperState {
  ngInjector: any;
}

/** Used by enterprise */
let bodyRenderHooks: ComponentType[] = [];

export function addBodyRenderHook(fn: ComponentType) {
  bodyRenderHooks.push(fn);
}

export class AppWrapper extends React.Component<AppWrapperProps, AppWrapperState> {
  container = React.createRef<HTMLDivElement>();

  constructor(props: AppWrapperProps) {
    super(props);

    this.state = {
      ngInjector: null,
    };
  }

  componentDidMount() {
    if (this.container) {
      this.bootstrapNgApp();
    } else {
      throw new Error('Failed to boot angular app, no container to attach to');
    }
  }

  bootstrapNgApp() {
    const injector = this.props.app.angularApp.bootstrap();
    this.setState({ ngInjector: injector });
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
    const navPosition = contextSrv.user.navPosition;
    const styles = getStyles(navPosition);
    navigationLogger('AppWrapper', false, 'rendering');

    // @ts-ignore
    const appSeed = `<grafana-app ng-cloak></app-notifications-list><div id="ngRoot"></div></grafana-app>`;

    return (
      <Provider store={store}>
        <ErrorBoundaryAlert style="page">
          <ConfigContext.Provider value={config}>
            <ThemeProvider>
              <ModalsProvider>
                <GlobalStyles />
                <div className={`grafana-app ${styles.grafanaApp}`}>
                  <Router history={locationService.getHistory()}>
                    <SideMenu />
                    <main className="main-view">
                      <div
                        ref={this.container}
                        dangerouslySetInnerHTML={{
                          __html: appSeed,
                        }}
                      />
                      <AppNotificationList />
                      <SearchWrapper />
                      {this.state.ngInjector && this.container && this.renderRoutes()}
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
      </Provider>
    );
  }
}

const getStyles = (navPosition: typeof contextSrv.user.navPosition) => ({
  grafanaApp: css`
    @media only screen and (min-width: 769px) {
      flex-direction: ${getFlexDirection(navPosition)};
    }
  `,
});
