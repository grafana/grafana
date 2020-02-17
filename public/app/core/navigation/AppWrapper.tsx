import * as React from 'react';
import { Router, Route } from 'react-router-dom';
import { GrafanaApp } from '../../app';
import angular from 'angular';
import { each, extend } from 'lodash';

import locationService from '../navigation/LocationService';
import { routes, RouteDescriptor } from '../../routes/routes';
import AngularRoute from './AngularRoute';
import { ThemeProvider, ConfigContext } from '../utils/ConfigProvider';
import { config } from '@grafana/runtime';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { contextSrv } from '../services/context_srv';
import { SideMenu } from '../components/sidemenu/SideMenu';

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
        key={`${route.path}`}
        render={props => {
          return React.createElement(route.component, {
            $injector: this.state.ngInjector,
            $rootScope: $rootScope,
            $contextSrv: contextSrv,
            routeInfo: route.routeInfo,
            query: locationService().getUrlSearchParams(),
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
    const appSeed = `<grafana-app ng-cloak>
<!--    <sidemenu class="sidemenu"></sidemenu>-->
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
              <div className="grafana-app">
                <Router history={locationService().getHistory()}>
                  <>
                    <SideMenu />
                    <div
                      ref={this.container}
                      dangerouslySetInnerHTML={{
                        __html: appSeed,
                      }}
                    />
                    <div className="main-view">{this.state.ngInjector && this.container && this.renderRoutes()}</div>
                  </>
                </Router>
              </div>
            </ThemeProvider>
          </ConfigContext.Provider>
        </ErrorBoundaryAlert>
      </Provider>
    );
  }
}
