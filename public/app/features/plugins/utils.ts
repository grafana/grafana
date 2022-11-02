import { Location as HistoryLocation } from 'history';

import { GrafanaPlugin, NavIndex, NavModel, NavModelItem, PanelPluginMeta, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { getRootSectionForNode } from 'app/core/selectors/navModel';

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
): NavModel | undefined {
  // When topnav is disabled we only just show pluginNav like before
  if (!config.featureToggles.topnav) {
    return pluginNav ?? undefined;
  }

  let section = getPluginSection(location, navIndex, pluginId);
  if (!section) {
    return undefined;
  }

  // shallow clone as we set active flag
  section = { ...section };

  // If we have plugin nav don't set active page in section as it will cause double breadcrumbs
  const currentUrl = config.appSubUrl + location.pathname + location.search;
  let activePage: NavModelItem | undefined;

  function setPageToActive(page: NavModelItem, currentUrl: string): NavModelItem {
    if (!currentUrl.startsWith(page.url ?? '')) {
      return page;
    }

    if (activePage && (activePage.url?.length ?? 0) > (page.url?.length ?? 0)) {
      return page;
    }

    if (activePage) {
      activePage.active = false;
    }

    activePage = { ...page, active: true };
    return activePage;
  }

  // Find and set active page
  section.children = (section?.children ?? []).map((child) => {
    if (child.children) {
      return {
        ...setPageToActive(child, currentUrl),
        children: child.children.map((pluginPage) => setPageToActive(pluginPage, currentUrl)),
      };
    }

    return setPageToActive(child, currentUrl);
  });

  return { main: section, node: activePage ?? section };
}

// TODO make work for sub pages
export function getPluginSection(location: HistoryLocation, navIndex: NavIndex, pluginId: string): NavModelItem {
  // First check if this page exist in navIndex using path, some plugin pages are not under their own section
  const byPath = navIndex[`standalone-plugin-page-${location.pathname}`];
  if (byPath) {
    return getRootSectionForNode(byPath);
  }

  // Some plugins like cloud home don't have any precense in the navtree so we need to allow those
  const navTreeNodeForPlugin = navIndex[`plugin-page-${pluginId}`];
  if (!navTreeNodeForPlugin) {
    return navIndex[HOME_NAV_ID];
  }

  if (!navTreeNodeForPlugin.parentItem) {
    throw new Error('Could not find plugin section');
  }

  return navTreeNodeForPlugin.parentItem;
}
