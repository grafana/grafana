import { PanelData, VisualizationSuggestion } from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

export async function getAllSuggestions(data?: PanelData): Promise<VisualizationSuggestion[]> {
  const plugins = ['timeseries', 'barchart', 'gauge', 'stat', 'piechart', 'bargauge', 'table'];
  const input = { data };
  const allSuggestions: VisualizationSuggestion[] = [];

  for (const pluginId of plugins) {
    const plugin = await importPanelPlugin(pluginId);
    const supplier = plugin.getSuggestionsSupplier();

    if (supplier) {
      const pluginSuggestions = supplier(input);

      if (pluginSuggestions && pluginSuggestions.length > 0) {
        allSuggestions.push(...pluginSuggestions);
      }
    }
  }

  return allSuggestions;
}
