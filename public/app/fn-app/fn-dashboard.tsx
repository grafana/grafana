import * as $ from 'jquery';
import React, { ComponentType } from 'react';

import { store } from 'app/store/store';

import { AngularRoot } from '../angular/AngularRoot';
import { loadAndInitAngularIfEnabled } from '../angular/loadAndInitAngularIfEnabled';

// import { GrafanaApp } from '../app';
// import { GrafanaContext } from '../core/context/GrafanaContext';
// import { I18nProvider } from '../core/internationalization';
// import { ThemeProvider } from '../core/utils/ConfigProvider';
// import DashboardPage, { Props } from '../features/dashboard/containers/DashboardPage';
// import { LiveConnectionWarning } from '../features/live/LiveConnectionWarning';
// import fn_app from '../fn_app';
// import { DashboardRoutes } from '../types';
import { FnAppProvider } from './fn-app-provider';
import { RenderFNDashboard } from './render-fn-dashboard';
import { FNDashboardProps } from './types';

/** Used by enterprise */
let bodyRenderHooks: ComponentType[] = [];
let pageBanners: ComponentType[] = [];

export function addBodyRenderHook(fn: ComponentType) {
  bodyRenderHooks.push(fn);
}

export function addPageBanner(fn: ComponentType) {
  pageBanners.push(fn);
}

export const FNDashboard: React.Component<FNDashboardProps> = (prop) => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    loadAndInitAngularIfEnabled();
    console.log('store in mount', store);
    setReady(true);
    $('.preloader').remove();
  }, []);

  if (!ready) {
    // FN:TODO add fn loading logo
    return <h1>App not ready</h1>;
  }

  if (!store) {
    // FN:TODO add fn loading store
    return <h1>No store inited</h1>;
  }

  return (
    <FnAppProvider>
      <div className="page-dashboard">
        <AngularRoot />
        <RenderFNDashboard {...prop} />
      </div>
    </FnAppProvider>
  );
};
