import { Location as HistoryLocation } from 'history';

import { GrafanaPlugin, NavIndex, NavModel, NavModelItem, PanelPluginMeta, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { importPanelPluginFromMeta } from './importPanelPlugin';
import { getPluginSettings } from './pluginSettings';
import { importAppPlugin, importDataSourcePlugin } from './plugin_loader';

export async function loadPlugin(pluginId: string): Promise<GrafanaPlugin> {
  const info = await getPluginSettings(pluginId);
  let result: GrafanaPlugin | undefined;

  if (info.type === PluginType.app) {
    result = await importAppPlugin(info);
  }
  if (info.type === PluginType.datasource) {
    result = await importDataSourcePlugin(info);
  }
  if (info.type === PluginType.panel) {
    const panelPlugin = await importPanelPluginFromMeta(info as PanelPluginMeta);
    result = panelPlugin as unknown as GrafanaPlugin;
  }
  if (info.type === PluginType.renderer) {
    result = { meta: info } as GrafanaPlugin;
  }

  if (!result) {
    throw new Error('Unknown Plugin type: ' + info.type);
  }

  return result;
}

export function buildPluginSectionNav(
  location: HistoryLocation,
  pluginNav: NavModel | null,
  navIndex: NavIndex,
  pluginId: string
) {
  // When topnav is disabled we only just show pluginNav like before
  if (!config.featureToggles.topnav) {
    return pluginNav;
  }

  const navTreeNodeForPlugin = navIndex[`plugin-page-${pluginId}`];
  if (!navTreeNodeForPlugin) {
    throw new Error('Plugin not found in navigation tree');
  }

  if (!navTreeNodeForPlugin.parentItem) {
    throw new Error('Could not find plugin section');
  }

  const pluginSection = navTreeNodeForPlugin.parentItem;
  const section = { ...pluginSection };

  // If we have plugin nav don't set active page in section as it will cause double breadcrumbs
  const currentUrl = config.appSubUrl + location.pathname + location.search;
  let activePage: NavModelItem | undefined;

  // Set active page
  section.children = (section?.children ?? []).map((child) => {
    if (child.children) {
      return {
        ...child,
        children: child.children.map((pluginPage) => {
          if (currentUrl.startsWith(pluginPage.url ?? '')) {
            activePage = {
              ...pluginPage,
              active: true,
            };
            return activePage;
          }
          return pluginPage;
        }),
      };
    }
    return child;
  });

  return { main: section, node: activePage ?? section };
}
