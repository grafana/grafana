import * as React from 'react';
import { Router } from 'react-router-dom';
import { GrafanaApp } from '../../app';
import angular from 'angular';
import { each, extend } from 'lodash';

// import { appEvents } from '../core';
import locationService from '../navigation/LocationService';
import { legacyRoutes } from '../../routes/routes';
import GrafanaRoute from '../navigation/GrafanaRoute';

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

  renderRoutes() {
    return (
      <>
        {legacyRoutes.map((descriptor, i) => {
          return (
            <GrafanaRoute
              {...descriptor}
              injector={this.state.ngInjector}
              mountContainer={this.container.current}
              key={i}
            />
          );
        })}
      </>
    );
  }

  render() {
    // tslint:disable-next-line
    const appSeed = `<grafana-app class="grafana-app"><sidemenu class="sidemenu"></sidemenu><div class="main-view"><div class="scroll-canvas" page-scrollbar><div id="ngRoot"></div></div></div></grafana-app>`;

    return (
      <Router history={locationService().getHistory()}>
        <>
          {this.state.ngInjector && this.container && this.renderRoutes()}
          <div
            ref={this.container}
            dangerouslySetInnerHTML={{
              __html: appSeed,
            }}
          />
        </>
      </Router>
    );
  }
}
