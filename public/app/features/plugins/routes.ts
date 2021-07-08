import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { RouteDescriptor } from 'app/core/navigation/types';

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

  return [
    {
      path: '/plugins',
      component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse')),
    },
    {
      path: '/plugins/browse',
      component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse')),
    },
    {
      path: '/plugins/:pluginId/',
      component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginPage" */ './admin/pages/PluginDetails')),
    },
  ];
}
