import * as React from 'react';
import { Router, Route, Redirect } from 'react-router-dom';
import { GrafanaApp } from '../../app';
import angular from 'angular';
import { each, extend } from 'lodash';

import { routes } from '../../routes/routes';
import AngularRoute from './AngularRoute';
import { ThemeProvider, ConfigContext } from '../utils/ConfigProvider';
import { config, getLocationService } from '@grafana/runtime';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import { ErrorBoundaryAlert, ModalRoot, ModalsProvider } from '@grafana/ui';
import { contextSrv } from '../services/context_srv';
import { SideMenu } from '../components/sidemenu/SideMenu';
import { RouteDescriptor } from './types';

interface AppWrapperProps {
  app: GrafanaApp;
}
interface AppWrapperState {
  ngInjector: any;
}

//TODO[Router]: move to usitls
const prepareQueryObject = (locationQuery: string) => {
  const params: Array<[string, string | boolean]> = [];
  new URLSearchParams(locationQuery).forEach((v, k) => params.push([k, parseValue(v)]));
  return Object.fromEntries(new Map(params));
};

//TODO[Router]: move to usitls
const parseValue = (value: string) => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
};

export default class AppWrapper extends React.Component<AppWrapperProps, AppWrapperState> {
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

    this.setState(
      { ngInjector: invoker },
      invoker.invoke(() => {
        each(app.preBootModules, module => {
          extend(module, app.registerFunctions);
        });
        app.preBootModules = null;
        // I don't know
        return () => {};
      })
    );
  }

  renderRoute = (route: RouteDescriptor, index: number) => {
    const isAngularRoute = !!route.controller;
    const { ngInjector } = this.state;
    const $rootScope = ngInjector.get('$rootScope');
    const roles = route.roles ? route.roles() : [];

    // TODO[Router]: test this logic
    if (roles && roles.length) {
      if (!roles.some(r => contextSrv.hasRole(r))) {
        return <Redirect to="/" />;
      }
    }

    if (isAngularRoute) {
      return (
        <AngularRoute
          {...route}
          injector={this.state.ngInjector}
          mountContainer={this.container.current}
          key={`${route.path}/${index}`}
        />
      );
    }
    return (
      <Route
        exact
        path={route.path}
        key={`${route.path}`}
        render={props => {
          return React.createElement(route.component, {
            $injector: this.state.ngInjector,
            $rootScope: $rootScope,
            $contextSrv: contextSrv,
            routeInfo: route.routeInfo,
            // @ts-ignore
            query: prepareQueryObject(props.location.search),
            // route: props.match,
            ...props,
          });
        }}
      />
    );
  };

  renderRoutes() {
    return <>{routes.map((descriptor, i) => this.renderRoute(descriptor, i))}</>;
  }

  render() {
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
