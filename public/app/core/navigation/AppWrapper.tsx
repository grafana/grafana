import * as React from 'react';
import { Router, Route } from 'react-router-dom';
import { GrafanaApp } from '../../app';
import angular from 'angular';
import { each, extend } from 'lodash';

// import { appEvents } from '../core';
import locationService from '../navigation/LocationService';
import { routes, RouteDescriptor } from '../../routes/routes';
import AngularRoute from './AngularRoute';
import { ThemeProvider, ConfigContext } from '../utils/ConfigProvider';
import { config } from '@grafana/runtime';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { contextSrv } from '../services/context_srv';

interface AppWrapperProps {
  app: GrafanaApp;
}
interface AppWrapperState {
  ngInjector: any;
}

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
        key={`${route.path}/${index}`}
        render={routeProps => {
          return React.createElement(route.component(), {
            $injector: this.state.ngInjector,
            routeInfo: route.routeInfo,
            $rootScope: $rootScope,
            $scope: $rootScope.$new(),
            $contextSrv: contextSrv,
          });
        }}
      />
    );
  };

  renderRoutes() {
    return <>{routes.map((descriptor, i) => this.renderRoute(descriptor, i))}</>;
  }

  render() {
    const appSeed = `<grafana-app class="grafana-app" ng-cloak>
    <sidemenu class="sidemenu"></sidemenu>
    <app-notifications-list class="page-alert-list"></app-notifications-list>
    <dashboard-search></dashboard-search>

    <div class="main-view">
      <div ng-view class="scroll-canvas"><div id="ngRoot"></div></div>
    </div>
  </grafana-app>`;

    return (
      <Provider store={store}>
        <ErrorBoundaryAlert style="page">
          <ConfigContext.Provider value={config}>
            <ThemeProvider>
              <Router history={locationService().getHistory()}>
                <>
                  <div
                    ref={this.container}
                    dangerouslySetInnerHTML={{
                      __html: appSeed,
                    }}
                  />
                  {this.state.ngInjector && this.container && this.renderRoutes()}
                </>
              </Router>
            </ThemeProvider>
          </ConfigContext.Provider>
        </ErrorBoundaryAlert>
      </Provider>
    );
  }
}
