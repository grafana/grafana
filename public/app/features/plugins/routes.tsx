import { NavModelItem } from '@grafana/data';
import { RouteDescriptor } from 'app/core/navigation/types';
import { getRootSectionForNode } from 'app/core/selectors/navModel';
import AppRootPage from 'app/features/plugins/components/AppRootPage';
import { getState } from 'app/store/store';

const isPluginNavModelItem = (model: NavModelItem): model is PluginNavModelItem => 'pluginId' in model && 'id' in model;
const isStandalonePluginPage = (id: string) => id.startsWith('standalone-plugin-page-/');

function getPathForNavItem(navItem: PluginNavModelItem) {
  const pluginNavSection = getRootSectionForNode(navItem);
  const appPluginUrl = `/a/${navItem.pluginId}`;
  const path = isStandalonePluginPage(navItem.id) ? navItem.url || appPluginUrl : appPluginUrl; // Only standalone pages can use core URLs, otherwise we fall back to "/a/:pluginId"
  const isSensitive = isStandalonePluginPage(navItem.id) && !navItem.url?.startsWith('/a/'); // Have case-sensitive URLs only for standalone pages that have custom URLs

  return {
    path: `${path}/*`,
    sensitive: isSensitive,
    component: () => <AppRootPage pluginId={navItem.pluginId} pluginNavSection={pluginNavSection} />,
  };
}

export function getAppPluginRoutes(): RouteDescriptor[] {
  const state = getState();
  const { navIndex } = state;
  const explicitAppPluginRoutes = Object.values(navIndex)
    .filter<PluginNavModelItem>(isPluginNavModelItem)
    .map(getPathForNavItem);

  return [
    ...explicitAppPluginRoutes,

    // Fallback route for plugins that don't have any pages under includes
    {
      path: '/a/:pluginId/*',
      component: () => <AppRootPage pluginNavSection={navIndex.home} />,
    },
  ];
}

export function getRouteForAppPlugin(pluginId: string): RouteDescriptor {
  const state = getState();
  const { navIndex } = state;
  const navItem = Object.values(navIndex)
    .filter<PluginNavModelItem>(isPluginNavModelItem)
    .find((navItem) => navItem.pluginId === pluginId);

  if (!navItem) {
    return {
      path: '/a/:pluginId/*',
      component: () => <AppRootPage pluginNavSection={navIndex.home} />,
    };
  }

  return getPathForNavItem(navItem);
}

interface PluginNavModelItem extends Omit<NavModelItem, 'pluginId' | 'id'> {
  pluginId: string;
  id: string;
}
