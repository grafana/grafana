import { FieldConfigSource, PanelPlugin, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

/**
 * Synchronously get presets
 */
export function getPluginPresets(
  plugin: PanelPlugin,
  fieldConfig?: FieldConfigSource,
  options?: unknown
): PanelPluginVisualizationSuggestion[] {
  return plugin.getPresets({ fieldConfig, options }) ?? [];
}

/**
 * Returns presets for a panel
 * @TODO: error handling?
 */
export async function getPresets(
  pluginId: string,
  fieldConfig?: FieldConfigSource,
  options?: unknown
): Promise<PanelPluginVisualizationSuggestion[]> {
  const plugin = await importPanelPlugin(pluginId);
  return getPluginPresets(plugin, fieldConfig, options);
}
