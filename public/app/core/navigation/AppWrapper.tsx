import * as React from 'react';
import { Router, Route } from 'react-router-dom';
import { GrafanaApp } from '../../app';
import angular from 'angular';
import { each, extend } from 'lodash';

// import { appEvents } from '../core';
import locationService from '../navigation/LocationService';
import { legacyRoutes, reactRoutes } from '../../routes/routes';
import GrafanaRoute from '../navigation/GrafanaRoute';
import { ThemeProvider, ConfigContext } from '../utils/ConfigProvider';
import { config } from '@grafana/runtime';
import { Provider } from 'react-redux';
import { store } from '../../store/store';
import { ErrorBoundaryAlert } from '@grafana/ui';

interface AppWrapperProps {
  app: GrafanaApp;
  injector: any;
}

export default class AppWrapper extends React.Component<AppWrapperProps, AppWrapperState> {
  container = React.createRef<HTMLDivElement>();

  // constructor(props: AppWrapperProps) {
  //   super(props);

  //   this.state = {
  //     ngInjector: null,
  //   };
  // }

  // componentDidMount() {
  //   if (this.container) {
  //     this.bootstrapNgApp();
  //   } else {
  //     throw new Error('Failed to boot angular app, no container to attach to');
  //   }
  // }

  // bootstrapNgApp() {
  //   const { app } = this.props;
  //   console.log('Bootstrappiong angular app')

  //   this.setState(
  //     { ngInjector: invoker },
  //     invoker.invoke(() => {
  //       each(app.preBootModules, module => {
  //         extend(module, app.registerFunctions);
  //       });
  //       app.preBootModules = null;
  //       // I don't know
  //       return () => {};
  //     })
  //   );
  // }

  renderRoutes() {
    return (
      <>
        {legacyRoutes.map((descriptor, i) => {
          return (
            <GrafanaRoute
              {...descriptor}
              injector={this.props.injector}
              mountContainer={this.container.current}
              key={i}
            />
          );
        })}
        {reactRoutes.map((descriptor, i) => {
          return (
            <Route
              exact
              path={descriptor.path}
              key={`${descriptor.path}/${i}`}
              render={routeProps => {
                debugger;
                return React.createElement(descriptor.component, {});
              }}
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
      <>
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
                    {this.props.injector && this.container && this.renderRoutes()}
                  </>
                </Router>
              </ThemeProvider>
            </ConfigContext.Provider>
          </ErrorBoundaryAlert>
        </Provider>
      </>
    );
  }
}
