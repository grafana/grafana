import { FieldConfigSource, PanelPlugin, PanelPluginVisualizationSuggestion } from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

/**
 * Synchronously get presets
 */
export function getPluginPresets(
  plugin: PanelPlugin,
  fieldConfig?: FieldConfigSource
): PanelPluginVisualizationSuggestion[] {
  return plugin.getPresets({ fieldConfig }) ?? [];
}

/**
 * Returns presets for a panel
 * @TODO: error handling?
 */
export async function getPresets(
  pluginId: string,
  fieldConfig?: FieldConfigSource
): Promise<PanelPluginVisualizationSuggestion[]> {
  const plugin = await importPanelPlugin(pluginId);
  return getPluginPresets(plugin, fieldConfig);
}
