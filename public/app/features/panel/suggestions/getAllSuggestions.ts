import {
  getPanelDataSummary,
  PanelData,
  PanelDataSummary,
  PanelPlugin,
  PanelPluginVisualizationSuggestion,
  PreferredVisualisationType,
  VisualizationSuggestionScore,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { importPanelPlugin, isBuiltInPlugin } from 'app/features/plugins/importPanelPlugin';

import { getAllPanelPluginMeta } from '../state/util';

import { panelsToCheckFirst } from './consts';

/**
 * gather and cache the plugins which provide visualization suggestions so they can be invoked to build suggestions
 */
async function getPanelsWithSuggestions(): Promise<PanelPlugin[]> {
  // list of plugins to load is determined by the feature flag
  const pluginIds: string[] = config.featureToggles.externalVizSuggestions
    ? getAllPanelPluginMeta()
        .filter((panel) => panel.suggestions)
        .map((m) => m.id)
    : panelsToCheckFirst;

  // import the plugins in parallel using Promise.allSettled
  const plugins: PanelPlugin[] = [];
  const settledPromises = await Promise.allSettled(pluginIds.map((id) => importPanelPlugin(id)));
  for (let i = 0; i < settledPromises.length; i++) {
    const settled = settledPromises[i];

    if (settled.status === 'fulfilled') {
      plugins.push(settled.value);
    }
    // TODO: do we want to somehow log if there were errors loading some of the plugins?
  }

  if (plugins.length === 0) {
    throw new Error('No panel plugins with visualization suggestions found');
  }

  return plugins;
}

/**
 * some of the PreferredVisualisationTypes do not match the panel plugin ids, so we have to map them. d'oh.
 */
const PLUGIN_ID_TO_PREFERRED_VIZ_TYPE: Record<string, PreferredVisualisationType> = {
  traces: 'trace',
  timeseries: 'graph',
  table: 'table',
  logs: 'logs',
  nodeGraph: 'nodeGraph',
  flamegraph: 'flamegraph',
};
const mapPreferredVisualisationTypeToPlugin = (type: string): PreferredVisualisationType | undefined => {
  return PLUGIN_ID_TO_PREFERRED_VIZ_TYPE[type];
};

/**
 * given a list of suggestions, sort them in place based on score and preferred visualisation type
 */
export function sortSuggestions(suggestions: PanelPluginVisualizationSuggestion[], dataSummary: PanelDataSummary) {
  suggestions.sort((a, b) => {
    // if one of these suggestions is from a built-in panel and the other isn't, prioritize the core panel.
    const isPluginABuiltIn = isBuiltInPlugin(a.pluginId);
    const isPluginBBuiltIn = isBuiltInPlugin(b.pluginId);
    if (isPluginABuiltIn && !isPluginBBuiltIn) {
      return -1;
    }
    if (isPluginBBuiltIn && !isPluginABuiltIn) {
      return 1;
    }

    // if a preferred visualisation type matches the data, prioritize it
    const mappedA = mapPreferredVisualisationTypeToPlugin(a.pluginId);
    if (mappedA && dataSummary.hasPreferredVisualisationType(mappedA)) {
      return -1;
    }
    const mappedB = mapPreferredVisualisationTypeToPlugin(b.pluginId);
    if (mappedB && dataSummary.hasPreferredVisualisationType(mappedB)) {
      return 1;
    }

    // compare scores directly if there are no other factors
    return (b.score ?? VisualizationSuggestionScore.OK) - (a.score ?? VisualizationSuggestionScore.OK);
  });
}

/**
 * given PanelData, return a sorted list of Suggestions from all plugins which support it.
 * @param {PanelData} data queried and transformed data for the panel
 * @returns {PanelPluginVisualizationSuggestion[]} sorted list of suggestions
 */
export async function getAllSuggestions(data?: PanelData): Promise<PanelPluginVisualizationSuggestion[]> {
  const dataSummary = getPanelDataSummary(data?.series);
  const list: PanelPluginVisualizationSuggestion[] = [];

  for (const plugin of await getPanelsWithSuggestions()) {
    const suggestions = plugin.getSuggestions(dataSummary);
    if (suggestions) {
      list.push(...suggestions);
    }
  }

  if (dataSummary.fieldCount === 0) {
    for (const plugin of Object.values(config.panels)) {
      if (!plugin.skipDataQuery || plugin.hideFromList) {
        continue;
      }

      list.push({
        name: plugin.name,
        pluginId: plugin.id,
        description: plugin.info.description,
        hash: 'plugin-empty-' + plugin.id,
        cardOptions: {
          imgSrc: plugin.info.logos.small,
        },
      });
    }
  }

  sortSuggestions(list, dataSummary);

  return list;
}
