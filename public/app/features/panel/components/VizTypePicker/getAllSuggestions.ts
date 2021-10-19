import { PanelData, VisualizationSuggestion, VisualizationSuggestionsBuilder, PanelModel } from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

export async function getAllSuggestions(data?: PanelData, panel?: PanelModel): Promise<VisualizationSuggestion[]> {
  const plugins = ['timeseries', 'barchart', 'gauge', 'stat', 'piechart', 'bargauge', 'table'];
  const builder = new VisualizationSuggestionsBuilder(data, panel);

  if (!builder.dataSummary.hasData) {
    return builder.getList();
  }

  for (const pluginId of plugins) {
    const plugin = await importPanelPlugin(pluginId);
    const supplier = plugin.getSuggestionsSupplier();

    if (supplier) {
      supplier.getDataSuggestions(builder);
    }
  }

  return builder.getList();
}
