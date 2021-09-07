import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { RouteDescriptor } from 'app/core/navigation/types';
import { isGrafanaAdmin } from './admin/helpers';
import { PluginAdminRoutes } from './admin/types';

const pluginAdminRoutes = [
  {
    path: '/plugins',
    routeName: PluginAdminRoutes.Home,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse')),
  },
  {
    path: '/plugins/browse',
    routeName: PluginAdminRoutes.Browse,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse')),
  },
  {
    path: '/plugins/:pluginId/',
    routeName: PluginAdminRoutes.Details,
    component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginPage" */ './admin/pages/PluginDetails')),
  },
];

export function getPluginsAdminRoutes(cfg = config): RouteDescriptor[] {
  if (!cfg.pluginAdminEnabled) {
    return [
      {
        path: '/plugins',
        component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './PluginListPage')),
      },
      {
        path: '/plugins/browse',
        component: SafeDynamicImport(
          () => import(/* webpackChunkName: "PluginAdminNotEnabled" */ './admin/pages/NotEnabed')
        ),
      },
      {
        path: '/plugins/:pluginId/',
        component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginPage" */ './PluginPage')),
      },
    ];
  }

  if (isGrafanaAdmin()) {
    return [
      ...pluginAdminRoutes,
      {
        path: '/admin/plugins',
        routeName: PluginAdminRoutes.HomeAdmin,
        component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse')),
      },
      {
        path: '/admin/plugins/browse',
        routeName: PluginAdminRoutes.BrowseAdmin,
        component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse')),
      },
      {
        path: '/admin/plugins/:pluginId/',
        routeName: PluginAdminRoutes.DetailsAdmin,
        component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginPage" */ './admin/pages/PluginDetails')),
      },
    ];
  }

  return pluginAdminRoutes;
}
