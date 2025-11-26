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
  'histogram',
  'geomap',
];

/**
 * gather and cache the plugins which provide visualization suggestions so they can be invoked to build suggestions
 */
let _pluginCache: PanelPlugin[] | null = null;
async function getPanelsWithSuggestions(): Promise<PanelPlugin[]> {
  if (!_pluginCache) {
    _pluginCache = [];

    // list of plugins to load is determined by the feature flag
    const pluginIds: string[] = config.featureToggles.externalVizSuggestions
      ? getAllPanelPluginMeta()
          .filter((panel) => panel.suggestions)
          .map((m) => m.id)
      : panelsToCheckFirst;

    // import the plugins in parallel using Promise.allSettled
    const settledPromises = await Promise.allSettled(pluginIds.map((id) => importPanelPlugin(id)));
    for (let i = 0; i < settledPromises.length; i++) {
      const settled = settledPromises[i];

      if (settled.status === 'fulfilled') {
        _pluginCache.push(settled.value);
      }
      // TODO: do we want to somehow log if there were errors loading some of the plugins?
    }
  }

  if (_pluginCache.length === 0) {
    throw new Error('No panel plugins with visualization suggestions found');
  }

  return _pluginCache;
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
function sortSuggestions(suggestions: PanelPluginVisualizationSuggestion[], dataSummary: PanelDataSummary) {
  suggestions.sort((a, b) => {
    const mappedA = mapPreferredVisualisationTypeToPlugin(a.pluginId);
    if (mappedA && dataSummary.hasPreferredVisualisationType(mappedA)) {
      return -1;
    }
    const mappedB = mapPreferredVisualisationTypeToPlugin(a.pluginId);
    if (mappedB && dataSummary.hasPreferredVisualisationType(mappedB)) {
      return 1;
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
  const plugins = await getPanelsWithSuggestions();

  for (const plugin of plugins) {
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
