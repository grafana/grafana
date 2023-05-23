import { SafeDynamicImport } from '../../core/components/DynamicImports/SafeDynamicImport';
import { config } from '../../core/config';
import { RouteDescriptor } from '../../core/navigation/types';
import { DashboardRoutes } from '../../types';

export const getPublicDashboardRoutes = (): RouteDescriptor[] => {
  const routes: RouteDescriptor[] = [];
  if (config.featureToggles.publicDashboards) {
    routes.push(
      ...[
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
                /* webpackChunkName: "PublicDashboardPage" */ '../../features/dashboard/containers/PublicDashboardPage'
              )
          ),
        },
      ]
    );
  }
  // TODO add feature toggle
  if (true) {
    routes.push({
      path: '/d-embed/:uid',
      pageClass: 'dashboard-embed',
      routeName: DashboardRoutes.Embed,
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "EmbeddedDashboardPage" */ '../../features/dashboard/containers/EmbeddedDashboardPage'
          )
      ),
    });
  }

  return routes;
};
