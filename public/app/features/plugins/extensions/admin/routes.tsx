import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { contextSrv } from 'app/core/core';
import { RouteDescriptor } from 'app/core/navigation/types';
import { AccessControlAction } from 'app/types';

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
  return [
    {
      path: '/extensions/:id?',
      component: SafeDynamicImport(() => import(/* webpackChunkName: "ExtensionsAdmin" */ './pages/Extensions')),
      roles: evaluateAccess(
        // TODO: maybe we should have a separate permission for this
        [AccessControlAction.PluginsInstall, AccessControlAction.PluginsWrite],
        ['Admin', 'ServerAdmin']
      ),
    },
    {
      path: '/extensions/explore/:id?',
      component: SafeDynamicImport(() => import(/* webpackChunkName: "ExtensionsAdmin" */ './pages/Extensions')),
      roles: evaluateAccess(
        // TODO: maybe we should have a separate permission for this
        [AccessControlAction.PluginsInstall, AccessControlAction.PluginsWrite],
        ['Admin', 'ServerAdmin']
      ),
    },
  ];
}
