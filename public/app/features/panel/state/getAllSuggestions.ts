import { PanelData, VisualizationSuggestion, VisualizationSuggestionsBuilder, PanelModel } from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

export async function getAllSuggestions(data?: PanelData, panel?: PanelModel): Promise<VisualizationSuggestion[]> {
  const plugins = [
    'timeseries',
    'barchart',
    'gauge',
    'stat',
    'piechart',
    'bargauge',
    'table',
    'state-timeline',
    'text',
    'dashlist',
  ];
  const builder = new VisualizationSuggestionsBuilder(data, panel);

  for (const pluginId of plugins) {
    const plugin = await importPanelPlugin(pluginId);
    const supplier = plugin.getSuggestionsSupplier();

    if (supplier) {
      supplier.getSuggestions(builder);
    }
  }

  return builder.getList();
}
