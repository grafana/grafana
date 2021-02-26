import React from 'react';
import { Router, Route, Redirect, Switch } from 'react-router-dom';
import angular from 'angular';
import { each, extend } from 'lodash';
import { config, getLocationService } from '@grafana/runtime';
import { Provider } from 'react-redux';
import { store } from 'app/store/store';
import { ErrorBoundaryAlert, ModalRoot, ModalsProvider } from '@grafana/ui';
import { GrafanaApp } from '../app';
import { routes } from 'app/routes/routes';
import { ConfigContext, ThemeProvider } from './utils/ConfigProvider';
import { RouteDescriptor } from './navigation/types';
import { contextSrv } from './services/context_srv';
import { SideMenu } from './components/sidemenu/SideMenu';
import { navigationLogger, queryStringToJSON, shouldForceReload } from './navigation/utils';
import { updateLocation } from './actions';
import { GrafanaRoute, SyncLocationWithRedux } from './navigation/GrafanaRoute';

interface AppWrapperProps {
  app: GrafanaApp;
}

interface AppWrapperState {
  ngInjector: any;
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
    const { app } = this.props;
    const invoker = angular.bootstrap(document, app.ngModuleDependencies);
    navigationLogger('AppWrapper', false, 'Angular app bootstrap');
    this.setState(
      { ngInjector: invoker },
      invoker.invoke(() => {
        each(app.preBootModules, (module) => {
          extend(module, app.registerFunctions);
        });
        app.preBootModules = null;
        // I don't know
        return () => {};
      })
    );
  }

  renderRoute = (route: RouteDescriptor) => {
    // const { updateLocation } = this.props;
    // TODO[Router]
    // @ts-ignore
    const roles = route.roles ? route.roles() : [];

    return (
      <Route
        exact
        path={route.path}
        key={`${route.path}`}
        render={(props) => {
          navigationLogger('AppWrapper', false, 'Rendering route', route, 'with match', props.location);

          if (shouldForceReload(props.location.search)) {
            navigationLogger('AppWrapper', false, 'Force login', props.location);
            window.location.href = `${props.location.pathname}${props.location.search}`;
            return null;
          }

          // TODO[Router]: test this logic
          if (roles && roles.length) {
            if (!roles.some((r: string) => contextSrv.hasRole(r))) {
              return <Redirect to="/" />;
            }
          }

          return (
            <SyncLocationWithRedux {...props}>
              <GrafanaRoute
                {...props}
                component={route.component}
                route={route}
                $injector={this.state.ngInjector}
                $contextSrv={contextSrv}
              />
            </SyncLocationWithRedux>
          );
        }}
      />
    );
  };

  renderRoutes() {
    return <Switch>{routes.map((r) => this.renderRoute(r))}</Switch>;
  }

  render() {
    navigationLogger('AppWrapper', false, 'rendering');

    // @ts-ignore
    const appSeed = `<grafana-app ng-cloak><app-notifications-list class="page-alert-list"></app-notifications-list><dashboard-search></dashboard-search><div ng-view class="scroll-canvas"><div id="ngRoot"></div></div></grafana-app>`;

    return (
      <Provider store={store}>
        <ErrorBoundaryAlert style="page">
          <ConfigContext.Provider value={config}>
            <ThemeProvider>
              <ModalsProvider>
                <>
                  <div className="grafana-app">
                    <Router history={getLocationService().getHistory()}>
                      <>
                        <SideMenu />
                        <div className="main-view">
                          <div
                            ref={this.container}
                            dangerouslySetInnerHTML={{
                              __html: appSeed,
                            }}
                          />
                          {this.state.ngInjector && this.container && this.renderRoutes()}
                        </div>
                      </>
                    </Router>
                  </div>
                  <ModalRoot />
                </>
              </ModalsProvider>
            </ThemeProvider>
          </ConfigContext.Provider>
        </ErrorBoundaryAlert>
      </Provider>
    );
  }
}
