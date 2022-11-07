import React from 'react';

import { NavModelItem } from '@grafana/data';
import { RouteDescriptor } from 'app/core/navigation/types';
import { getRootSectionForNode } from 'app/core/selectors/navModel';
import AppRootPage from 'app/features/plugins/components/AppRootPage';
import { getState } from 'app/store/store';

export function getAppPluginRoutes(): RouteDescriptor[] {
  const state = getState();
  const { navIndex } = state;
  const isStandalonePluginPage = (id: string) => id.startsWith('standalone-plugin-page-/');
  const isPluginNavModelItem = (model: NavModelItem): model is PluginNavModelItem =>
    'pluginId' in model && 'id' in model;

  return Object.values(navIndex)
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
}

interface PluginNavModelItem extends Omit<NavModelItem, 'pluginId' | 'id'> {
  pluginId: string;
  id: string;
}
