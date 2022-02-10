import { VisualizationSuggestion, PanelModel, PanelPlugin, PanelData } from '@grafana/data';

export function getOptionSuggestions(
  plugin: PanelPlugin,
  panel: PanelModel,
  data?: PanelData
): VisualizationSuggestion[] {
  // const supplier = plugin.getSuggestionsSupplier();

  // if (supplier && supplier.getOptionSuggestions) {
  //   const builder = new VisualizationSuggestionsBuilder(data, panel);
  //   supplier.getOptionSuggestions(builder);
  //   return builder.getList();
  // }

  return [];
}
