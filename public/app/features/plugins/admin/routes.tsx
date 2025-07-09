import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { contextSrv } from 'app/core/core';
import { RouteDescriptor } from 'app/core/navigation/types';
import { AccessControlAction } from 'app/types/accessControl';

import { PluginAdminRoutes } from './types';

const DEFAULT_ROUTES = [
  {
    path: '/plugins',
    navId: 'plugins',
    roles: evaluateAccess(
      [AccessControlAction.PluginsInstall, AccessControlAction.PluginsWrite],
      ['Admin', 'ServerAdmin']
    ),
    routeName: PluginAdminRoutes.Home,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './pages/Browse')),
  },
  {
    path: '/plugins/browse',
    navId: 'plugins',
    roles: evaluateAccess(
      [AccessControlAction.PluginsInstall, AccessControlAction.PluginsWrite],
      ['Admin', 'ServerAdmin']
    ),
    routeName: PluginAdminRoutes.Browse,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './pages/Browse')),
  },
  {
    path: '/plugins/:pluginId/',
    navId: 'plugins',
    roles: evaluateAccess(
      [AccessControlAction.PluginsInstall, AccessControlAction.PluginsWrite],
      ['Admin', 'ServerAdmin']
    ),
    routeName: PluginAdminRoutes.Details,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginPage" */ './pages/PluginDetails')),
  },
];

// FIXME: If plugin admin is disabled or externally managed, server admins still need to access the page, this is why
// while we don't have a permissions for listing plugins the legacy check has to stay as a default
function evaluateAccess(actions: AccessControlAction[], userRoles: string[]): () => string[] {
  return () => {
    if (actions.some((action) => contextSrv.hasPermission(action))) {
      // If the user has any of the required actions, no need to check the role
      return [];
    } else {
      // User had no action, check the org role
      return userRoles;
    }
  };
}

export function getRoutes(): RouteDescriptor[] {
  return DEFAULT_ROUTES;
}
