import { PanelPluginMeta, PluginState, unEscapeStringFromRegex } from '@grafana/data';
import { config } from 'app/core/config';

export function getAllPanelPluginMeta(): PanelPluginMeta[] {
  const allPanels = config.panels;

  return Object.keys(allPanels)
    .filter((key) => allPanels[key]['hideFromList'] === false)
    .map((key) => allPanels[key])
    .sort((a: PanelPluginMeta, b: PanelPluginMeta) => a.sort - b.sort);
}

export function getWidgetPluginMeta(): PanelPluginMeta[] {
  return getAllPanelPluginMeta().filter((panel) => !!panel.skipDataQuery);
}

export function filterWidgetList(widgetsList: PanelPluginMeta[], searchQuery: string, current?: PanelPluginMeta) {
  if (!searchQuery.length) {
    return getNotDeprecatedPluginList(widgetsList, current);
  }

  return widgetsList.filter((plugin) => plugin.name.toLowerCase().includes(searchQuery.toLowerCase()));
}

function getNotDeprecatedPluginList(pluginsList: PanelPluginMeta[], current?: PanelPluginMeta): PanelPluginMeta[] {
  return pluginsList.filter((p) => {
    if (p.state === PluginState.deprecated) {
      return current?.id === p.id;
    }
    return true;
  });
}

export function filterPluginList(
  pluginsList: PanelPluginMeta[],
  searchQuery: string, // Note: this will be an escaped regex string as it comes from `FilterInput`
  current: PanelPluginMeta
): PanelPluginMeta[] {
  if (!searchQuery.length) {
    return getNotDeprecatedPluginList(pluginsList, current);
  }

  const query = unEscapeStringFromRegex(searchQuery).toLowerCase();
  const first: PanelPluginMeta[] = [];
  const match: PanelPluginMeta[] = [];
  const isGraphQuery = 'graph'.startsWith(query);

  for (const item of pluginsList) {
    if (item.state === PluginState.deprecated && current.id !== item.id) {
      continue;
    }

    const name = item.name.toLowerCase();
    const idx = name.indexOf(query);

    if (idx === 0) {
      first.push(item);
    } else if (idx > 0) {
      match.push(item);
    } else if (isGraphQuery && item.id === 'timeseries') {
      first.push(item);
    }
  }

  return first.concat(match);
}
