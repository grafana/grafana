import { GrafanaPlugin, NavModel, NavModelItem, PanelPluginMeta, PluginType } from '@grafana/data';
import { createMonitoringLogger } from '@grafana/runtime';

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

export function buildPluginSectionNav(currentUrl: string, pluginNavSection?: NavModelItem): NavModel | undefined {
  if (!pluginNavSection) {
    return undefined;
  }
  // shallow clone as we set active flag
  const MAX_RECURSION_DEPTH = 10;
  let copiedPluginNavSection = { ...pluginNavSection };
  let activePage: NavModelItem | undefined;

  function setPageToActive(page: NavModelItem, currentUrl: string): NavModelItem {
    if (!currentUrl.startsWith(page.url ?? '')) {
      return page;
    }

    // Check if there is already an active page found with with a more specific url (possibly a child of the current page)
    // (In this case we bail out early and don't mark the parent as active)
    if (activePage && (activePage.url?.length ?? 0) > (page.url?.length ?? 0)) {
      return page;
    }

    if (activePage) {
      activePage.active = false;
    }

    activePage = { ...page, active: true };

    return activePage;
  }

  function findAndSetActivePage(child: NavModelItem, depth = 0): NavModelItem {
    if (depth > MAX_RECURSION_DEPTH) {
      return child;
    }

    if (child.children) {
      // Doing this here to make sure that first we check if any of the children is active
      // (In case yes, then the check for the parent will not mark it as active)
      const children = child.children.map((pluginPage) => findAndSetActivePage(pluginPage, depth + 1));

      return {
        ...setPageToActive(child, currentUrl),
        children,
      };
    }

    return setPageToActive(child, currentUrl);
  }

  // Find and set active page
  copiedPluginNavSection.children = (copiedPluginNavSection?.children ?? []).map(findAndSetActivePage);

  return { main: copiedPluginNavSection, node: activePage ?? copiedPluginNavSection };
}

export const pluginsLogger = createMonitoringLogger('features.plugins');
