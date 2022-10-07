import React from 'react';

import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { Page } from 'app/core/components/PageNew/Page';
import { config } from 'app/core/config';
import { RouteDescriptor } from 'app/core/navigation/types';
import { AppPluginLoader } from 'app/features/plugins/components/AppPluginLoader';
import { store } from 'app/store/store';

import { ROUTE_BASE_ID } from './constants';

export function getRoutes(): RouteDescriptor[] {
  const navIndex = store.getState().navIndex;
  const isCloud = Boolean(navIndex['standalone-plugin-page-/connections/agent']);

  if (config.featureToggles.dataConnectionsConsole) {
    if (isCloud) {
      return [
        {
          path: `/${ROUTE_BASE_ID}`,
          exact: false,
          component: () => (
            <Page navId="connections">
              <AppPluginLoader id="grafana-easystart-app" basePath="/connections" />
            </Page>
          ),
        },
      ];
    }

    return [
      {
        path: `/${ROUTE_BASE_ID}`,
        exact: false,
        component: SafeDynamicImport(
          () => import(/* webpackChunkName: "DataConnectionsPage"*/ 'app/features/connections/ConnectionsPage')
        ),
      },
    ];
  }

  return [];
}
