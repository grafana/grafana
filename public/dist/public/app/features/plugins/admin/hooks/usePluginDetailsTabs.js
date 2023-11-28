import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PluginIncludeType, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { usePluginConfig } from '../hooks/usePluginConfig';
import { PluginTabIds, PluginTabLabels } from '../types';
export const usePluginDetailsTabs = (plugin, pageId) => {
    var _a;
    const { loading, error, value: pluginConfig } = usePluginConfig(plugin);
    const { pathname } = useLocation();
    const defaultTab = useDefaultPage(plugin, pluginConfig);
    const isPublished = Boolean(plugin === null || plugin === void 0 ? void 0 : plugin.isPublished);
    const currentPageId = pageId || defaultTab;
    const navModelChildren = useMemo(() => {
        var _a;
        const canConfigurePlugins = plugin && contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin);
        const navModelChildren = [];
        if (isPublished) {
            navModelChildren.push({
                text: PluginTabLabels.VERSIONS,
                id: PluginTabIds.VERSIONS,
                icon: 'history',
                url: `${pathname}?page=${PluginTabIds.VERSIONS}`,
                active: PluginTabIds.VERSIONS === currentPageId,
            });
        }
        // Not extending the tabs with the config pages if the plugin is not installed
        if (!pluginConfig) {
            return navModelChildren;
        }
        if (config.featureToggles.panelTitleSearch && pluginConfig.meta.type === PluginType.panel) {
            navModelChildren.push({
                text: PluginTabLabels.USAGE,
                icon: 'list-ul',
                id: PluginTabIds.USAGE,
                url: `${pathname}?page=${PluginTabIds.USAGE}`,
                active: PluginTabIds.USAGE === currentPageId,
            });
        }
        if (!canConfigurePlugins) {
            return navModelChildren;
        }
        if (pluginConfig.meta.type === PluginType.app) {
            if (pluginConfig.angularConfigCtrl) {
                navModelChildren.push({
                    text: 'Config',
                    icon: 'cog',
                    id: PluginTabIds.CONFIG,
                    url: `${pathname}?page=${PluginTabIds.CONFIG}`,
                    active: PluginTabIds.CONFIG === currentPageId,
                });
            }
            if (pluginConfig.configPages) {
                for (const configPage of pluginConfig.configPages) {
                    navModelChildren.push({
                        text: configPage.title,
                        icon: configPage.icon,
                        id: configPage.id,
                        url: `${pathname}?page=${configPage.id}`,
                        active: configPage.id === currentPageId,
                    });
                }
            }
            if ((_a = pluginConfig.meta.includes) === null || _a === void 0 ? void 0 : _a.find((include) => include.type === PluginIncludeType.dashboard)) {
                navModelChildren.push({
                    text: 'Dashboards',
                    icon: 'apps',
                    id: PluginTabIds.DASHBOARDS,
                    url: `${pathname}?page=${PluginTabIds.DASHBOARDS}`,
                    active: PluginTabIds.DASHBOARDS === currentPageId,
                });
            }
        }
        return navModelChildren;
    }, [plugin, pluginConfig, pathname, isPublished, currentPageId]);
    const navModel = {
        text: (_a = plugin === null || plugin === void 0 ? void 0 : plugin.name) !== null && _a !== void 0 ? _a : '',
        img: plugin === null || plugin === void 0 ? void 0 : plugin.info.logos.small,
        children: [
            {
                text: PluginTabLabels.OVERVIEW,
                icon: 'file-alt',
                id: PluginTabIds.OVERVIEW,
                url: `${pathname}?page=${PluginTabIds.OVERVIEW}`,
                active: PluginTabIds.OVERVIEW === currentPageId,
            },
            ...navModelChildren,
        ],
    };
    return {
        error,
        loading,
        navModel,
        activePageId: currentPageId,
    };
};
function useDefaultPage(plugin, pluginConfig) {
    var _a;
    if (!plugin || !pluginConfig) {
        return PluginTabIds.OVERVIEW;
    }
    const hasAccess = contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin);
    if (!hasAccess || pluginConfig.meta.type !== PluginType.app) {
        return PluginTabIds.OVERVIEW;
    }
    if (pluginConfig.angularConfigCtrl) {
        return PluginTabIds.CONFIG;
    }
    if ((_a = pluginConfig.configPages) === null || _a === void 0 ? void 0 : _a.length) {
        return pluginConfig.configPages[0].id;
    }
    return PluginTabIds.OVERVIEW;
}
//# sourceMappingURL=usePluginDetailsTabs.js.map