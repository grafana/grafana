import { GrafanaPlugin, NavModel, NavModelItem, PanelPluginMeta, PluginType } from '@grafana/data';
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
  pluginNavSection: NavModelItem,
  pluginNav: NavModel | null,
  currentUrl: string
): NavModel | undefined {
  // When topnav is disabled we only just show pluginNav like before
  if (!config.featureToggles.topnav) {
    return pluginNav ?? undefined;
  }

  // shallow clone as we set active flag
  let copiedPluginNavSection = { ...pluginNavSection };
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
  copiedPluginNavSection.children = (copiedPluginNavSection?.children ?? []).map((child) => {
    if (child.children) {
      return {
        ...setPageToActive(child, currentUrl),
        children: child.children.map((pluginPage) => setPageToActive(pluginPage, currentUrl)),
      };
    }

    return setPageToActive(child, currentUrl);
  });

  return { main: copiedPluginNavSection, node: activePage ?? copiedPluginNavSection };
}
