import React, { ComponentType } from 'react';
import { Provider } from 'react-redux';

import { config, navigationLogger } from '@grafana/runtime';
import { ErrorBoundaryAlert, GlobalStyles, ModalRoot, ModalsProvider, PortalContainer } from '@grafana/ui';
import { store, setStore } from 'app/store/store';

import { AngularRoot } from './angular/AngularRoot';
import { loadAndInitAngularIfEnabled } from './angular/loadAndInitAngularIfEnabled';
import { GrafanaApp } from './app';
import { GrafanaContext } from './core/context/GrafanaContext';
import { I18nProvider } from './core/internationalization';
import { ThemeProvider } from './core/utils/ConfigProvider';
import DashboardPage, { Props } from './features/dashboard/containers/DashboardPage';
import { LiveConnectionWarning } from './features/live/LiveConnectionWarning';
import fn_app from './fn_app';
import { DashboardRoutes } from './types';

interface FNDashboardProps {
  uid: string;
  slug: string;
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

export const FNDashboard: React.FunctionComponent<FNDashboardProps> = ({ slug, uid }) => {
  const app = fn_app;
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    loadAndInitAngularIfEnabled();
    console.log('store in mount', store);
    setReady(true);
    $('.preloader').remove();
  }, []);

  const renderFNDashboard = () => {
    console.log('renderFNDashboard with slug: ', slug);
    console.log('dashboard uid', uid);
    const props = {
      match: {
        params: {
          slug,
          uid,
        },
        isExact: true,
        path: '/d/:uid/:slug?',
        url: '',
      },
      // eslint-disable-next-line
      history: {} as any,
      // eslint-disable-next-line
      location: {} as any,
      queryParams: {},
      route: {
        routeName: DashboardRoutes.Normal,
        path: '/d/:uid/:slug?',
        pageClass: 'page-dashboard',
        component: DashboardPage,
      },
    };

    return <DashboardPage isFNDashboard {...props} />;
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
                <div className="page-dashboard">
                  <AngularRoot />
                  {renderFNDashboard()}
                </div>
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
