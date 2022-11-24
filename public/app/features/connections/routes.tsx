import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { RouteDescriptor } from 'app/core/navigation/types';

import { ROUTE_BASE_ID } from './constants';

export function getRoutes(): RouteDescriptor[] {
  if (config.featureToggles.dataConnectionsConsole) {
    return [
      {
        path: `/${ROUTE_BASE_ID}`,
        exact: false,
        component: SafeDynamicImport(
          () => import(/* webpackChunkName: "Connections"*/ 'app/features/connections/Connections')
        ),
      },
    ];
  }

  return [];
}
