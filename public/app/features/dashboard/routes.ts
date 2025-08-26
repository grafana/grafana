import { DashboardRoutes } from 'app/types/dashboard';

import { SafeDynamicImport } from '../../core/components/DynamicImports/SafeDynamicImport';
import { config } from '../../core/config';
import { RouteDescriptor } from '../../core/navigation/types';

export const getPublicDashboardRoutes = (): RouteDescriptor[] => {
  if (!config.publicDashboardsEnabled) {
    return [];
  }

  return [
    {
      path: '/dashboard/public',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Public,
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "ListPublicDashboardPage" */ '../../features/manage-dashboards/PublicDashboardListPage'
          )
      ),
    },
    {
      path: '/public-dashboards/:accessToken',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Public,
      chromeless: true,
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "PublicDashboardPage" */ '../../features/dashboard/containers/PublicDashboardPageProxy'
          )
      ),
    },
  ];
};
