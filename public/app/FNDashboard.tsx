import React, { ComponentType } from 'react';
import { Provider } from 'react-redux';

import { config, navigationLogger } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider, PortalContainer } from '@grafana/ui';
import { store, setStore } from 'app/store/store';

import { loadAndInitAngularIfEnabled } from './angular/loadAndInitAngularIfEnabled';
import { GrafanaApp } from './app';
import { GrafanaContext } from './core/context/GrafanaContext';
import { I18nProvider } from './core/internationalization';
import { ThemeProvider } from './core/utils/ConfigProvider';
import DashboardPage from './features/dashboard/containers/DashboardPage';
import PublicDashboardPage, { Props } from './features/dashboard/containers/PublicDashboardPage';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';
import fn_app from './fn_app';
import { DashboardRoutes } from './types';

interface FNDashboardProps {
  accessToken: string;
  uid: string;
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

export const FNDashboard: React.FunctionComponent<FNDashboardProps> = ({ accessToken, uid }) => {
  const app = fn_app;
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    //loadAndInitAngularIfEnabled();
    console.log('store in mount', store);
    setReady(true);
    $('.preloader').remove();
  }, []);

  const renderFNDashboard = () => {
    console.log('renderFNDashboard with token: ', accessToken);
    console.log('dashboard uid', uid);
    const props: Props = {
      match: {
        params: {
          accessToken: accessToken,
          uid,
        },
        isExact: true,
        path: 'public-dashboard/:accessToken',
        url: '',
      },
      // eslint-disable-next-line
      history: {} as any,
      // eslint-disable-next-line
      location: {} as any,
      queryParams: {},
      route: {
        routeName: DashboardRoutes.Public,
        path: '/public-dashboard/:accessToken',
        pageClass: 'page-dashboard',
        component: PublicDashboardPage,
      },
    };

    return <PublicDashboardPage {...props} />;
  };

  if (!ready) {
    return <h1>App not ready</h1>;
  }

  if (!store) {
    return <h1>No store inited</h1>;
  }

  navigationLogger('AppWrapper', false, 'rendering');

  return (
    <Provider store={store}>
      <I18nProvider>
        <ErrorBoundaryAlert style="page">
          <GrafanaContext.Provider value={app.context}>
            <ThemeProvider value={config.theme2}>
              <ModalsProvider>
                <GlobalStyles />
                {renderFNDashboard()}
                <LiveConnectionWarning />
                <ModalRoot />
                <PortalContainer />
              </ModalsProvider>
            </ThemeProvider>
          </GrafanaContext.Provider>
        </ErrorBoundaryAlert>
      </I18nProvider>
    </Provider>
  );
};

/*
export class FNDashboard extends React.Component<FNDashboardProps> {
  app!: GrafanaApp;
  constructor(props: FNDashboardProps) {
    super(props);
    this.state = {};
    this.app = fn_app;

  }

  async componentDidMount() {
    await loadAndInitAngularIfEnabled();
    console.log('store in mount', store);
    this.setState({ ready: true });
    $('.preloader').remove();
  }

  renderFNDashboard() {
    const { accessToken, uid } = this.props;
    console.log('renderFNDashboard with token: ', accessToken);
    console.log('dashboard uid', uid);
    const props: Props = {
      match: {
        params: {
          accessToken: accessToken,
          uid,
        },
        isExact: true,
        path: 'd/:uid',
        url: '',
      },
      // eslint-disable-next-line
      history: {
        location: {
          state: undefined
        }
      } as any,
      // eslint-disable-next-line
      location: {
        hash: "",
        key: `${uid}`,
        pathname: '/d/:uid',
        search: "",
        state: undefined,
      } as any,
      queryParams: {},
      route: {
        routeName: DashboardRoutes.Public,
        path: '/public-dashboard/:accessToken',
        pageClass: 'page-dashboard',
        component: PublicDashboardPage,
      },
    };

    return <PublicDashboardPage {...props} />;
  }

  render() {
    navigationLogger('AppWrapper', false, 'rendering');

    if (!store) {
      return <h1>Dupa</h1>
    }

    return (
      <Provider store={store}>
        <I18nProvider>
          <ErrorBoundaryAlert style="page">
            <GrafanaContext.Provider value={this.app.context}>
              <ThemeProvider value={config.theme2}>
                <ModalsProvider>
                  <GlobalStyles />
                  {this.renderFNDashboard()}
                  <LiveConnectionWarning />
                  <ModalRoot />
                  <PortalContainer />
                </ModalsProvider>
              </ThemeProvider>
            </GrafanaContext.Provider>
          </ErrorBoundaryAlert>
        </I18nProvider>
      </Provider>
    );
  }
}
*/
