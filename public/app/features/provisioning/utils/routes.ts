import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from 'app/core/navigation/types';
import { DashboardRoutes } from 'app/types';

export function getProvisioningRoutes(): RouteDescriptor[] {
  return [
    {
      path: '/admin/provisioning',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "RepositoryListPage"*/ 'app/features/provisioning/RepositoryListPage')
      ),
    },
    {
      path: '/admin/provisioning/new',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NewRepositoryPage"*/ 'app/features/provisioning/NewRepositoryPage')
      ),
    },
    {
      path: '/admin/provisioning/:name',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "RepositoryStatusPage"*/ 'app/features/provisioning/RepositoryStatusPage')
      ),
    },
    {
      path: '/admin/provisioning/:name/edit',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "EditRepositoryPage"*/ 'app/features/provisioning/EditRepositoryPage')
      ),
    },
    {
      path: '/admin/provisioning/:slug/dashboard/preview/*',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Provisioning,
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "DashboardScenePage" */ 'app/features/dashboard-scene/pages/DashboardScenePage')
      ),
    },
  ];
}
