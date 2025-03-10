import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from 'app/core/navigation/types';
import { DashboardRoutes } from 'app/types';

import { checkRequiredFeatures } from '../GettingStarted/features';
import { PROVISIONING_URL, CONNECT_URL, MIGRATE_URL, GETTING_STARTED_URL } from '../constants';

export function getProvisioningRoutes(): RouteDescriptor[] {
  if (!checkRequiredFeatures()) {
    return [
      {
        path: PROVISIONING_URL,
        component: SafeDynamicImport(
          () =>
            import(
              /* webpackChunkName: "GettingStartedPage"*/ 'app/features/provisioning/GettingStarted/GettingStartedPage'
            )
        ),
      },
    ];
  }

  return [
    {
      path: PROVISIONING_URL,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "RepositoryListPage"*/ 'app/features/provisioning/RepositoryListPage')
      ),
    },
    {
      path: GETTING_STARTED_URL,
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "GettingStartedPage"*/ 'app/features/provisioning/GettingStarted/GettingStartedPage'
          )
      ),
    },
    {
      path: CONNECT_URL,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "ProvisioningWizardPage"*/ 'app/features/provisioning/Wizard/ConnectPage')
      ),
    },
    {
      path: MIGRATE_URL,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "ProvisioningWizardPage"*/ 'app/features/provisioning/Wizard/MigratePage')
      ),
    },
    {
      path: PROVISIONING_URL + '/:name',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "RepositoryStatusPage"*/ 'app/features/provisioning/RepositoryStatusPage')
      ),
    },
    {
      path: PROVISIONING_URL + '/:name/edit',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "EditRepositoryPage"*/ 'app/features/provisioning/EditRepositoryPage')
      ),
    },
    {
      path: PROVISIONING_URL + '/:name/file/*',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FileStatusPage"*/ 'app/features/provisioning/FileStatusPage')
      ),
    },
    {
      path: PROVISIONING_URL + '/:name/history/*',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FileHistoryPage"*/ 'app/features/provisioning/FileHistoryPage')
      ),
    },
    {
      path: PROVISIONING_URL + '/:slug/dashboard/preview/*',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Provisioning,
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "DashboardScenePage" */ 'app/features/dashboard-scene/pages/DashboardScenePage')
      ),
    },
  ];
}
