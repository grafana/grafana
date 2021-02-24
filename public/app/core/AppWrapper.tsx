import React, { useEffect } from 'react';
import { Router, Route, Redirect } from 'react-router-dom';
import angular from 'angular';
import { each, extend } from 'lodash';
import { config, getLocationService } from '@grafana/runtime';
import { Provider } from 'react-redux';
import { store } from 'app/store/store';
import { ErrorBoundaryAlert, ModalRoot, ModalsProvider } from '@grafana/ui';
import { GrafanaApp } from '../app';
import { routes } from 'app/routes/routes';
import { ConfigContext, ThemeProvider } from './utils/ConfigProvider';
import { GrafanaRouteProps, RouteDescriptor } from './navigation/types';
import { contextSrv } from './services/context_srv';
import { SideMenu } from './components/sidemenu/SideMenu';
import { navigationLogger, queryStringToJSON } from './navigation/utils';
import { updateLocation } from './actions';

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

  renderRoute = (route: RouteDescriptor, index: number) => {
    // const { updateLocation } = this.props;
    // TODO[Router]
    // @ts-ignore
    const isAngularRoute = !!route.controller;
    // TODO[Router]
    // @ts-ignore
    const roles = route.roles ? route.roles() : [];

    // TODO[Router]: test this logic
    if (roles && roles.length) {
      if (!roles.some((r: string) => contextSrv.hasRole(r))) {
        return <Redirect to="/" />;
      }
    }

    if (isAngularRoute) {
      return null;
    }

    return (
      <Route
        exact
        path={route.path}
        key={`${route.path}`}
        render={(props) => {
          navigationLogger('AppWrapper', false, 'Rendering route', route, 'with match', props.location);

          store.dispatch(
            updateLocation({
              path: props.location.pathname,
              routeParams: props.match.params,
              query: queryStringToJSON(props.location.search),
            })
          );

          return (
            <GrafanaRoute
              {...props}
              component={route.component}
              pageClass={route.pageClass}
              $injector={this.state.ngInjector}
              $contextSrv={contextSrv}
              routeInfo={route.routeInfo}
            />
          );
        }}
      />
    );
  };

  renderRoutes() {
    return <>{routes.map((descriptor, i) => this.renderRoute(descriptor, i))}</>;
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
                        <div className={'sidemenu'}>
                          <SideMenu />
                        </div>
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

const GrafanaRoute: React.FC<GrafanaRouteProps<any>> = (props) => {
  useEffect(() => {
    navigationLogger('GrafanaRoute', false, 'Mounted', props.match);
    if (props.pageClass) {
      document.body.classList.add(props.pageClass);
    }
    return () => {
      if (props.pageClass) {
        document.body.classList.remove(props.pageClass);
      }
    };
  });

  const { component, ...routeComponentProps } = props;

  return React.createElement(component, {
    ...routeComponentProps,
  });
};
