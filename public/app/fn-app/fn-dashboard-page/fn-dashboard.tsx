import React, { ComponentType, FC } from 'react';

import { AngularRoot } from '../../angular/AngularRoot';
import { FnAppProvider } from '../fn-app-provider';
import { FNDashboardProps } from '../types';

import { RenderFNDashboard } from './render-fn-dashboard';

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
