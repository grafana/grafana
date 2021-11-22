import React, { ComponentType } from 'react';
import { Router, Route, Redirect, Switch } from 'react-router-dom';
import { config, locationService, navigationLogger } from '@grafana/runtime';
import { Provider } from 'react-redux';
import { store } from 'app/store/store';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider } from '@grafana/ui';
import { GrafanaApp } from './app';
import { getAppRoutes } from 'app/routes/routes';
import { ConfigContext, ThemeProvider } from './core/utils/ConfigProvider';
import { RouteDescriptor } from './core/navigation/types';
import { contextSrv } from './core/services/context_srv';
import { NavBar } from './core/components/NavBar/NavBar';
import { NavBarNext } from './core/components/NavBar/NavBarNext';
import { GrafanaRoute } from './core/navigation/GrafanaRoute';
import { AppNotificationList } from './core/components/AppNotifications/AppNotificationList';
import { SearchWrapper } from 'app/features/search';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';
import { AngularRoot } from './angular/AngularRoot';
import { I18nProvider } from '@lingui/react';
import { getI18n } from './core/localisation';

interface AppWrapperProps {
  app: GrafanaApp;
}

interface AppWrapperState {
  ngInjector: any;
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
  container = React.createRef<HTMLDivElement>();
  i18n = getI18n();

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

  render() {
    navigationLogger('AppWrapper', false, 'rendering');

    const newNavigationEnabled = config.featureToggles.newNavigation;

    return (
      <Provider store={store}>
        <I18nProvider i18n={this.i18n}>
          <ErrorBoundaryAlert style="page">
            <ConfigContext.Provider value={config}>
              <ThemeProvider>
                <ModalsProvider>
                  <GlobalStyles />
                  <div className="grafana-app">
                    <Router history={locationService.getHistory()}>
                      {newNavigationEnabled ? <NavBarNext /> : <NavBar />}
                      <main className="main-view">
                        {pageBanners.map((Banner, index) => (
                          <Banner key={index.toString()} />
                        ))}

                        <AngularRoot ref={this.container} />
                        <AppNotificationList />
                        <SearchWrapper />
                        {this.state.ngInjector && this.renderRoutes()}
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
        </I18nProvider>
      </Provider>
    );
  }
}
