import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from 'app/core/navigation/types';

import { isGrafanaAdmin } from './permissions';
import { PluginAdminRoutes } from './types';

const DEFAULT_ROUTES = [
  {
    path: '/plugins',
    navId: 'plugins',
    routeName: PluginAdminRoutes.Home,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './pages/Browse')),
  },
  {
    path: '/plugins/browse',
    navId: 'plugins',
    routeName: PluginAdminRoutes.Browse,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './pages/Browse')),
  },
  {
    path: '/plugins/:pluginId/',
    navId: 'plugins',
    routeName: PluginAdminRoutes.Details,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginPage" */ './pages/PluginDetails')),
  },
];

const ADMIN_ROUTES = [
  {
    path: '/admin/plugins',
    navId: 'admin-plugins',
    routeName: PluginAdminRoutes.HomeAdmin,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './pages/Browse')),
  },
  {
    path: '/admin/plugins/browse',
    navId: 'admin-plugins',
    routeName: PluginAdminRoutes.BrowseAdmin,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './pages/Browse')),
  },
  {
    path: '/admin/plugins/:pluginId/',
    navId: 'admin-plugins',
    routeName: PluginAdminRoutes.DetailsAdmin,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginPage" */ './pages/PluginDetails')),
  },
];

export function getRoutes(): RouteDescriptor[] {
  if (isGrafanaAdmin()) {
    return [...DEFAULT_ROUTES, ...ADMIN_ROUTES];
  }

  return DEFAULT_ROUTES;
}
