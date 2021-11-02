import { __read, __spreadArray } from "tslib";
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { isGrafanaAdmin } from './admin/permissions';
import { PluginAdminRoutes } from './admin/types';
var pluginAdminRoutes = [
    {
        path: '/plugins',
        routeName: PluginAdminRoutes.Home,
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse'); }),
    },
    {
        path: '/plugins/browse',
        routeName: PluginAdminRoutes.Browse,
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse'); }),
    },
    {
        path: '/plugins/:pluginId/',
        routeName: PluginAdminRoutes.Details,
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PluginPage" */ './admin/pages/PluginDetails'); }),
    },
];
export function getPluginsAdminRoutes(cfg) {
    if (cfg === void 0) { cfg = config; }
    if (!cfg.pluginAdminEnabled) {
        return [
            {
                path: '/plugins',
                component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PluginListPage" */ './PluginListPage'); }),
            },
            {
                path: '/plugins/browse',
                component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PluginAdminNotEnabled" */ './admin/pages/NotEnabed'); }),
            },
            {
                path: '/plugins/:pluginId/',
                component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PluginPage" */ './PluginPage'); }),
            },
        ];
    }
    if (isGrafanaAdmin()) {
        return __spreadArray(__spreadArray([], __read(pluginAdminRoutes), false), [
            {
                path: '/admin/plugins',
                routeName: PluginAdminRoutes.HomeAdmin,
                component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse'); }),
            },
            {
                path: '/admin/plugins/browse',
                routeName: PluginAdminRoutes.BrowseAdmin,
                component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PluginListPage" */ './admin/pages/Browse'); }),
            },
            {
                path: '/admin/plugins/:pluginId/',
                routeName: PluginAdminRoutes.DetailsAdmin,
                component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PluginPage" */ './admin/pages/PluginDetails'); }),
            },
        ], false);
    }
    return pluginAdminRoutes;
}
//# sourceMappingURL=routes.js.map