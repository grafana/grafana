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
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { getAllPanelPluginMeta } from '../state/util';

export const panelsToCheckFirst = [
  'timeseries',
  'barchart',
  'gauge',
  'stat',
  'piechart',
  'bargauge',
  'table',
  'state-timeline',
  'status-history',
  'logs',
  'candlestick',
  'flamegraph',
  'traces',
  'nodeGraph',
  'heatmap',
];

/**
 * gather and cache the plugins which provide visualization suggestions so they can be invoked to build suggestions
 */
let _pluginCache: PanelPlugin[] | null = null;
async function getPanelsWithSuggestions(): Promise<PanelPlugin[]> {
  if (!_pluginCache) {
    _pluginCache = [];
    let pluginIds: string[] = panelsToCheckFirst;
    if (config.featureToggles.externalVizSuggestions) {
      pluginIds = (await getAllPanelPluginMeta()).map((m) => m.id);
    }
    for (const pluginId of pluginIds) {
      _pluginCache.push(await importPanelPlugin(pluginId));
    }
  }
  return _pluginCache;
}

/**
 * some of the PreferredVisualisationTypes do not match the panel plugin ids, so we have to map them. d'oh.
 */
const OVERRIDE_PREFERRED_VISUALISATION_TYPE_TO_PLUGIN: Partial<Record<PreferredVisualisationType, string>> = {
  trace: 'traces',
};

/**
 * given a list of suggestions, sort them in place based on score and preferred visualisation type
 */
function sortSuggestions(suggestions: PanelPluginVisualizationSuggestion[], dataSummary: PanelDataSummary) {
  suggestions.sort((a, b) => {
    if (dataSummary.preferredVisualisationType) {
      const mappedPlugin =
        OVERRIDE_PREFERRED_VISUALISATION_TYPE_TO_PLUGIN[dataSummary.preferredVisualisationType] ??
        dataSummary.preferredVisualisationType;

      if (a.pluginId === mappedPlugin) {
        return -1;
      }
      if (b.pluginId === mappedPlugin) {
        return 1;
      }
    }
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
        cardOptions: {
          imgSrc: plugin.info.logos.small,
        },
      });
    }
  }

  sortSuggestions(list, dataSummary);

  return list;
}
