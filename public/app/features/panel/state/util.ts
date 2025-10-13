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

export function getVizPluginMeta(): PanelPluginMeta[] {
  return getAllPanelPluginMeta().filter((panel) => !panel.skipDataQuery);
}

export function filterPluginList(
  pluginsList: PanelPluginMeta[],
  searchQuery: string, // Note: this will be an escaped regex string as it comes from `FilterInput`
  pluginId?: string
): PanelPluginMeta[] {
  if (!searchQuery.length) {
    return pluginsList.filter((p) => {
      if (p.state === PluginState.deprecated) {
        return pluginId === p.id;
      }
      return true;
    });
  }

  const query = unEscapeStringFromRegex(searchQuery).toLowerCase();
  const first: PanelPluginMeta[] = [];
  const match: PanelPluginMeta[] = [];
  const isGraphQuery = 'graph'.startsWith(query);

  for (const item of pluginsList) {
    if (item.state === PluginState.deprecated && pluginId !== item.id) {
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
