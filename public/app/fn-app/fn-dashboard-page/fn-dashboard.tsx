import React, { ComponentType } from 'react';

import { store } from 'app/store/store';

import { AngularRoot } from '../../angular/AngularRoot';
import { FnAppProvider } from '../fn-app-provider';
import { FNDashboardProps } from '../types';

import { RenderFNDashboard } from './render-fn-dashboard';
// import { GrafanaApp } from '../app';
// import { GrafanaContext } from '../core/context/GrafanaContext';
// import { I18nProvider } from '../core/internationalization';
// import { ThemeProvider } from '../core/utils/ConfigProvider';
// import DashboardPage, { Props } from '../features/dashboard/containers/DashboardPage';
// import { LiveConnectionWarning } from '../features/live/LiveConnectionWarning';
// import fn_app from '../fn_app';
// import { DashboardRoutes } from '../types';

/** Used by enterprise */
let bodyRenderHooks: ComponentType[] = [];
let pageBanners: ComponentType[] = [];

export function addBodyRenderHook(fn: ComponentType) {
  bodyRenderHooks.push(fn);
}

export function addPageBanner(fn: ComponentType) {
  pageBanners.push(fn);
}

export const FNDashboard: React.Component<FNDashboardProps> = (props) => {
  return (
    <FnAppProvider FnError={props.fnError}>
      <div className="page-dashboard">
        <AngularRoot />
        <RenderFNDashboard {...props} />
      </div>
    </FnAppProvider>
  );
};
