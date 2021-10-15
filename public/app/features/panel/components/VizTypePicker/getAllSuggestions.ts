import { PanelData, VisualizationSuggestion, VisualizationSuggestionsBuilder } from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

export async function getAllSuggestions(data?: PanelData): Promise<VisualizationSuggestion[]> {
  const plugins = ['timeseries', 'barchart', 'gauge', 'stat', 'piechart', 'bargauge', 'table'];
  const builder = new VisualizationSuggestionsBuilder(data, 'table', {}, { defaults: {}, overrides: [] });

  for (const pluginId of plugins) {
    const plugin = await importPanelPlugin(pluginId);
    const supplier = plugin.getSuggestionsSupplier();

    if (supplier) {
      supplier(builder);
    }
  }

  return builder.getList();
}
