import { VisualizationSuggestion } from '@grafana/data';
import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { getAllPanelPluginMeta } from '../state/util';

export interface PresetsResult {
  presets: VisualizationSuggestion[];
}

/**
 * Return presets for a panel
 * @param pluginId - ID of the panel to get presets for
 * @param panel - VizPanel instance for default preset and panel edit
 * @returns {PresetsResult} list of presets
 *
 * @TODO: error handling?
 */
export async function getPresetsForPanel(pluginId: string, panel?: VizPanel): Promise<PresetsResult> {
  if (!config.featureToggles.vizPresets) {
    return { presets: [] };
  }

  const pluginMeta = getAllPanelPluginMeta().find((p) => p.id === pluginId);
  const hasPresetsSupport = Boolean(pluginMeta?.presets);

  if (!hasPresetsSupport) {
    return { presets: [] };
  }

  try {
    const plugin = await importPanelPlugin(pluginId);
    const context = {
      options: panel?.state.options,
      fieldConfig: panel?.state.fieldConfig,
    };

    const presets = plugin.getPresets(context);

    return { presets: presets ?? [] };
  } catch (e) {
    console.error(`Failed to load presets for plugin "${pluginId}":`, e);

    return { presets: [] };
  }
}
