import { Navigate, useLocation, useParams } from 'react-router-dom-v5-compat';

import { config } from '@grafana/runtime';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { type RouteDescriptor } from 'app/core/navigation/types';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';
import { DashboardRoutes } from 'app/types/dashboard';

import { checkRequiredFeatures } from '../GettingStarted/features';
import {
  CONNECTIONS_URL,
  CONNECT_URL,
  GETTING_STARTED_URL,
  PROVISIONING_PREVIEW_URL,
  PROVISIONING_URL,
} from '../constants';

// The provisioning admin pages are for repository managers. Gating on read would let everyone in:
// `provisioning.repositories:read` is granted to the Viewer basic role (git-sync flows need it).
const adminRoles = () => contextSrv.evaluatePermission([AccessControlAction.ProvisioningRepositoriesWrite]);

// Connection pages have their own RBAC actions; custom roles may grant connection management
// without repository write access.
const connectionRoles = () =>
  contextSrv.evaluatePermission([
    AccessControlAction.ProvisioningConnectionsCreate,
    AccessControlAction.ProvisioningConnectionsWrite,
  ]);

export function getProvisioningRoutes(): RouteDescriptor[] {
  const featureToggles = config.featureToggles || {};
  if (!featureToggles.provisioning) {
    return [];
  }

  if (!checkRequiredFeatures()) {
    return [
      {
        path: PROVISIONING_URL,
        roles: adminRoles,
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
      roles: adminRoles,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "RepositoryListPage"*/ 'app/features/provisioning/HomePage')
      ),
    },
    {
      path: GETTING_STARTED_URL,
      roles: adminRoles,
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "GettingStartedPage"*/ 'app/features/provisioning/GettingStarted/GettingStartedPage'
          )
      ),
    },
    {
      path: `${CONNECTIONS_URL}/:name/edit`,
      roles: connectionRoles,
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "ConnectionFormPage"*/ 'app/features/provisioning/Connection/ConnectionFormPage')
      ),
    },
    {
      path: `${CONNECTIONS_URL}/new`,
      roles: connectionRoles,
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "ConnectionFormPage"*/ 'app/features/provisioning/Connection/ConnectionFormPage')
      ),
    },
    {
      path: `${CONNECT_URL}/:type`,
      roles: adminRoles,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "ProvisioningWizardPage"*/ 'app/features/provisioning/Wizard/ConnectPage')
      ),
    },
    {
      path: PROVISIONING_URL + '/:name',
      roles: adminRoles,
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "RepositoryStatusPage"*/ 'app/features/provisioning/Repository/RepositoryStatusPage'
          )
      ),
    },
    {
      path: PROVISIONING_URL + '/:name/edit',
      roles: adminRoles,
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "EditRepositoryPage"*/ 'app/features/provisioning/Repository/EditRepositoryPage')
      ),
    },
    {
      path: PROVISIONING_URL + '/:name/file/*',
      roles: adminRoles,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FileStatusPage"*/ 'app/features/provisioning/File/FileStatusPage')
      ),
    },
    {
      path: PROVISIONING_URL + '/:name/history/*',
      roles: adminRoles,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FileHistoryPage"*/ 'app/features/provisioning/File/FileHistoryPage')
      ),
    },
    {
      path: PROVISIONING_PREVIEW_URL + '/:slug/preview/*',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Provisioning,
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "DashboardScenePage" */ 'app/features/dashboard-scene/pages/DashboardScenePage')
      ),
    },
    {
      // This is a temporary route to redirect from old preview to the new preview URL
      path: PROVISIONING_URL + '/:slug/dashboard/preview/*',
      component: RedirectToProvisioningPreview,
    },
  ];
}

function RedirectToProvisioningPreview() {
  const { slug = '', '*': rest = '' } = useParams();
  const location = useLocation();
  // Preserve query params (ref, pull_request_url) from old PR comment links
  return <Navigate replace to={`${PROVISIONING_PREVIEW_URL}/${slug}/preview/${rest}${location.search}`} />;
}
