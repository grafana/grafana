import React from 'react';
import { getRootSectionForNode } from 'app/core/selectors/navModel';
import AppRootPage from 'app/features/plugins/components/AppRootPage';
import { getState } from 'app/store/store';
export function getAppPluginRoutes() {
    const state = getState();
    const { navIndex } = state;
    const isStandalonePluginPage = (id) => id.startsWith('standalone-plugin-page-/');
    const isPluginNavModelItem = (model) => 'pluginId' in model && 'id' in model;
    const explicitAppPluginRoutes = Object.values(navIndex)
        .filter(isPluginNavModelItem)
        .map((navItem) => {
        var _a;
        const pluginNavSection = getRootSectionForNode(navItem);
        const appPluginUrl = `/a/${navItem.pluginId}`;
        const path = isStandalonePluginPage(navItem.id) ? navItem.url || appPluginUrl : appPluginUrl; // Only standalone pages can use core URLs, otherwise we fall back to "/a/:pluginId"
        const isSensitive = isStandalonePluginPage(navItem.id) && !((_a = navItem.url) === null || _a === void 0 ? void 0 : _a.startsWith('/a/')); // Have case-sensitive URLs only for standalone pages that have custom URLs
        return {
            path,
            exact: false,
            sensitive: isSensitive,
            component: () => React.createElement(AppRootPage, { pluginId: navItem.pluginId, pluginNavSection: pluginNavSection }),
        };
    });
    return [
        ...explicitAppPluginRoutes,
        // Fallback route for plugins that don't have any pages under includes
        {
            path: '/a/:pluginId',
            exact: false,
            component: ({ match }) => React.createElement(AppRootPage, { pluginId: match.params.pluginId, pluginNavSection: navIndex.home }),
        },
    ];
}
//# sourceMappingURL=routes.js.map