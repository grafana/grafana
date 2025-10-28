import {
  PanelData,
  VisualizationSuggestion,
  VisualizationSuggestionsBuilder,
  PanelModel,
  VisualizationSuggestionScore,
  PanelPlugin,
  PanelPluginMeta,
} from '@grafana/data';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { getAllPanelPluginMeta } from './util';

let cachedPlugins: Array<[PanelPlugin, PanelPluginMeta]> | null = null;
async function getPluginsWithSuggestions(): Promise<NonNullable<typeof cachedPlugins>> {
  if (cachedPlugins == null) {
    cachedPlugins = [];
    for (const pluginMeta of getAllPanelPluginMeta()) {
      const plugin = await importPanelPlugin(pluginMeta.id);
      const supplier = plugin.getSuggestionsSupplier();
      if (supplier) {
        cachedPlugins.push([plugin, pluginMeta]);
      }
    }
  }
  return cachedPlugins;
}

export async function getAllSuggestions(data?: PanelData, panel?: PanelModel): Promise<VisualizationSuggestion[]> {
  const builder = new VisualizationSuggestionsBuilder(data, panel);
  const list = builder.getList();

  for (const [plugin, pluginMeta] of await getPluginsWithSuggestions()) {
    plugin.getSuggestionsSupplier()?.getSuggestionsForData(builder);

    if (builder.dataSummary.fieldCount === 0) {
      if (!pluginMeta.skipDataQuery || pluginMeta.hideFromList) {
        continue;
      }

      list.push({
        name: pluginMeta.name,
        pluginId: pluginMeta.id,
        description: pluginMeta.info.description,
        cardOptions: {
          imgSrc: pluginMeta.info.logos.small,
        },
      });
    }
  }

  return list.sort((a, b) => {
    if (builder.dataSummary.preferredVisualisationType) {
      if (a.pluginId === builder.dataSummary.preferredVisualisationType) {
        return -1;
      }
      if (b.pluginId === builder.dataSummary.preferredVisualisationType) {
        return 1;
      }
    }
    return (b.score ?? VisualizationSuggestionScore.OK) - (a.score ?? VisualizationSuggestionScore.OK);
  });
}
