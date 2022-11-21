import { SafeDynamicImport } from '../../core/components/DynamicImports/SafeDynamicImport';
import { config } from '../../core/config';
import { RouteDescriptor } from '../../core/navigation/types';
import { DashboardRoutes } from '../../types';

export const getPublicDashboardRoutes = (): RouteDescriptor[] => {
  if (config.featureToggles.publicDashboards) {
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
        component: SafeDynamicImport(
          () =>
            import(
              /* webpackChunkName: "PublicDashboardPage" */ '../../features/dashboard/containers/PublicDashboardPage'
            )
        ),
      },
    ];
  }

  return [];
};
