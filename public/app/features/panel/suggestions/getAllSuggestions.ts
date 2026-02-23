import {
  AppEvents,
  DataFrame,
  getPanelDataSummary,
  PanelDataSummary,
  PanelPlugin,
  PanelPluginVisualizationSuggestion,
  PreferredVisualisationType,
  VisualizationSuggestionScore,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { getPanelPluginMeta } from '@grafana/runtime/internal';
import { appEvents } from 'app/core/app_events';
import { isBuiltinPluginPath } from 'app/features/plugins/built_in_plugins';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { getAllPanelPluginMeta } from '../state/util';

import { panelsToCheckFirst } from './consts';

interface PluginLoadResult {
  plugins: PanelPlugin[];
  hasErrors: boolean;
}

function getPanelPluginIds(): string[] {
  return config.featureToggles.externalVizSuggestions
    ? getAllPanelPluginMeta()
        .filter((panel) => panel.suggestions)
        .map((m) => m.id)
    : panelsToCheckFirst;
}

async function isBuiltInPlugin(id?: string): Promise<boolean> {
  if (!id) {
    return false;
  }
  const meta = await getPanelPluginMeta(id);
  return Boolean(meta != null && isBuiltinPluginPath(meta.module));
}

/**
 * gather and cache the plugins which provide visualization suggestions so they can be invoked to build suggestions
 */
export async function loadPlugins(pluginIds: string[]): Promise<PluginLoadResult> {
  // import the plugins in parallel using Promise.allSettled
  const plugins: PanelPlugin[] = [];
  let hasErrors = false;
  const settledPromises = await Promise.allSettled(
    pluginIds.map(async (pluginId) => {
      return await importPanelPlugin(pluginId);
    })
  );

  for (let i = 0; i < settledPromises.length; i++) {
    const settled = settledPromises[i];
    if (settled.status === 'fulfilled') {
      plugins.push(settled.value);
    } else {
      const pluginId = pluginIds[i];
      console.error(`Failed to load ${pluginId} for visualization suggestions:`, settled.reason);

      if (await isBuiltInPlugin(pluginId)) {
        hasErrors = true;
      } else {
        appEvents.publish({
          type: AppEvents.alertError.name,
          payload: [
            t(
              'panel.visualization-suggestions.error-loading-suggestions.plugin-failed',
              'Failed to load panel plugin: {{ pluginId }}.',
              { pluginId }
            ),
          ],
        });
      }
    }
  }

  return { plugins, hasErrors };
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
export async function sortSuggestions(
  suggestions: PanelPluginVisualizationSuggestion[],
  dataSummary: PanelDataSummary
): Promise<void> {
  const builtInMap: Record<string, boolean> = {};
  await Promise.all(
    suggestions.map(async (s) => {
      const isBuiltIn = await isBuiltInPlugin(s.pluginId);
      builtInMap[s.pluginId] = isBuiltIn;
    })
  );

  suggestions.sort((a, b) => {
    // if one of these suggestions is from a built-in panel and the other isn't, prioritize the core panel.
    const isPluginABuiltIn = builtInMap[a.pluginId];
    const isPluginBBuiltIn = builtInMap[b.pluginId];
    if (isPluginABuiltIn && !isPluginBBuiltIn) {
      return -1;
    }
    if (isPluginBBuiltIn && !isPluginABuiltIn) {
      return 1;
    }

    // if a preferred visualisation type matches the data, prioritize it
    const mappedA = mapPreferredVisualisationTypeToPlugin(a.pluginId);
    const mappedB = mapPreferredVisualisationTypeToPlugin(b.pluginId);
    if (mappedA !== mappedB) {
      if (mappedA && dataSummary.hasPreferredVisualisationType(mappedA)) {
        return -1;
      }
      if (mappedB && dataSummary.hasPreferredVisualisationType(mappedB)) {
        return 1;
      }
    }

    // compare scores directly if there are no other factors
    return (b.score ?? VisualizationSuggestionScore.OK) - (a.score ?? VisualizationSuggestionScore.OK);
  });
}

export interface SuggestionsResult {
  suggestions: PanelPluginVisualizationSuggestion[];
  hasErrors: boolean;
}

/**
 * given PanelData, return a sorted list of Suggestions from all plugins which support it.
 * @param {DataFrame[]} series data frames
 * @returns {SuggestionsResult} sorted list of suggestions and error status
 */
export async function getAllSuggestions(series?: DataFrame[]): Promise<SuggestionsResult> {
  const dataSummary = getPanelDataSummary(series);
  const list: PanelPluginVisualizationSuggestion[] = [];

  const pluginIds: string[] = getPanelPluginIds();
  const { plugins, hasErrors: pluginLoadErrors } = await loadPlugins(pluginIds);

  let pluginSuggestionsError = false;
  for (const plugin of plugins) {
    try {
      const suggestions = plugin.getSuggestions(dataSummary);
      if (suggestions) {
        list.push(...suggestions);
      }
    } catch (e) {
      console.warn(`error when loading suggestions from plugin "${plugin.meta.id}"`, e);
      pluginSuggestionsError = true;
    }
  }

  await sortSuggestions(list, dataSummary);

  return { suggestions: list, hasErrors: pluginLoadErrors || pluginSuggestionsError };
}
