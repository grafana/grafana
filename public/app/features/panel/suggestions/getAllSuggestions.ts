import {
  PanelData,
  VisualizationSuggestion,
  VisualizationSuggestionsBuilder,
  PanelModel,
  PanelPlugin,
} from '@grafana/data';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

let cachedPlugins: PanelPlugin[] | null = null;
async function getPluginsWithSuggestions(): Promise<NonNullable<typeof cachedPlugins>> {
  if (cachedPlugins == null) {
    cachedPlugins = [];
    for (const { id: pluginId } of getAllPanelPluginMeta()) {
      const plugin = await importPanelPlugin(pluginId);
      if (plugin.hasSuggestionsSupplier()) {
        cachedPlugins.push(plugin);
      }
    }
  }
  return cachedPlugins;
}

export async function getAllSuggestions(data?: PanelData, panel?: PanelModel): Promise<VisualizationSuggestion[]> {
  const builder = new VisualizationSuggestionsBuilder(data, panel);

  for (const plugin of await getPluginsWithSuggestions()) {
    plugin.getSuggestionsForData(builder);
  }

  return builder.getSortedList();
}
