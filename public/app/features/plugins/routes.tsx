import React from 'react';

import { NavModelItem } from '@grafana/data';
import { RouteDescriptor } from 'app/core/navigation/types';
import { HOME_NAV_ID } from 'app/core/reducers/_navModel';
import { findNavModelItem, getFlattenedNavTree, getRootSectionForNode } from 'app/core/selectors/navBarTree';
import AppRootPage from 'app/features/plugins/components/AppRootPage';
import { getState } from 'app/store/store';

export function getAppPluginRoutes(): RouteDescriptor[] {
  const state = getState();
  const { navBarTree } = state;
  const homeNavItem = findNavModelItem(navBarTree, HOME_NAV_ID)!; // TODO: sort out non-null bang

  const isStandalonePluginPage = (id: string) => id.startsWith('standalone-plugin-page-/');
  const isPluginNavModelItem = (model: NavModelItem): model is PluginNavModelItem =>
    'pluginId' in model && 'id' in model;

  const explicitAppPluginRoutes = getFlattenedNavTree(navBarTree)
    .filter<PluginNavModelItem>(isPluginNavModelItem)
    .map((navItem) => {
      const pluginNavSection = getRootSectionForNode(navItem);
      const appPluginUrl = `/a/${navItem.pluginId}`;
      const path = isStandalonePluginPage(navItem.id) ? navItem.url || appPluginUrl : appPluginUrl; // Only standalone pages can use core URLs, otherwise we fall back to "/a/:pluginId"

      return {
        path,
        exact: false, // route everything under this path to the plugin, so it can define more routes under this path
        component: () => <AppRootPage pluginId={navItem.pluginId} pluginNavSection={pluginNavSection} />,
      };
    });

  return [
    ...explicitAppPluginRoutes,

    // Fallback route for plugins that don't have any pages under includes
    {
      path: '/a/:pluginId',
      exact: false, // route everything under this path to the plugin, so it can define more routes under this path
      component: ({ match }) => <AppRootPage pluginId={match.params.pluginId} pluginNavSection={homeNavItem} />,
    },
  ];
}

interface PluginNavModelItem extends Omit<NavModelItem, 'pluginId' | 'id'> {
  pluginId: string;
  id: string;
}
