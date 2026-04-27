import { type DataFrame } from '@grafana/data/dataframe';
import { getPanelDataSummary, type PanelPlugin } from '@grafana/data/panel';
import type { PanelPluginVisualizationSuggestion } from '@grafana/data/types';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

/**
 * Synchronously get presets
 */
export function getPluginPresets(plugin: PanelPlugin, data?: DataFrame[]): PanelPluginVisualizationSuggestion[] {
  const dataSummary = getPanelDataSummary(data);
  return plugin.getPresets({ dataSummary }) ?? [];
}

/**
 * Returns presets for a panel
 * @TODO: error handling?
 */
export async function getPresets(pluginId: string, data?: DataFrame[]): Promise<PanelPluginVisualizationSuggestion[]> {
  const plugin = await importPanelPlugin(pluginId);
  return getPluginPresets(plugin, data);
}
