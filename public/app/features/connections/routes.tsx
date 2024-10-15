import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from 'app/core/navigation/types';

import { ROUTES } from './constants';

export function getRoutes(): RouteDescriptor[] {
  return [
    {
      path: ROUTES.Base,
      exact: false,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "Connections"*/ 'app/features/connections/Connections')
      ),
    },
  ];
}
