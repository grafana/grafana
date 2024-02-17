import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from 'app/core/navigation/types';

import { ROUTE_BASE_ID } from './constants';

export function getRoutes(): RouteDescriptor[] {
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
