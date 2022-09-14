import React, { ComponentType, FC } from 'react';

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
const bodyRenderHooks: ComponentType[] = [];
const pageBanners: ComponentType[] = [];

export function addBodyRenderHook(fn: ComponentType) {
  bodyRenderHooks.push(fn);
}

export function addPageBanner(fn: ComponentType) {
  pageBanners.push(fn);
}

export const FNDashboard: FC<FNDashboardProps> = (props) => {
  return (
    <FnAppProvider fnError={props.fnError}>
      <div className="page-dashboard">
        <AngularRoot />
        <RenderFNDashboard {...props} />
      </div>
    </FnAppProvider>
  );
};
