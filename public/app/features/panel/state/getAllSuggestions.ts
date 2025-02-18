import {
  PanelData,
  VisualizationSuggestion,
  VisualizationSuggestionsBuilder,
  PanelModel,
  VisualizationSuggestionScore,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

export const panelsToCheckFirst = [
  'timeseries',
  'barchart',
  'gauge',
  'stat',
  'piechart',
  'bargauge',
  'table',
  'state-timeline',
  'status-history',
  'logs',
  'candlestick',
  'flamegraph',
  'traces',
  'nodeGraph',
];

export async function getAllSuggestions(data?: PanelData, panel?: PanelModel): Promise<VisualizationSuggestion[]> {
  const builder = new VisualizationSuggestionsBuilder(data, panel);

  for (const pluginId of panelsToCheckFirst) {
    const plugin = await importPanelPlugin(pluginId);
    const supplier = plugin.getSuggestionsSupplier();

    if (supplier) {
      supplier.getSuggestionsForData(builder);
    }
  }

  const list = builder.getList();

  if (builder.dataSummary.fieldCount === 0) {
    for (const plugin of Object.values(config.panels)) {
      if (!plugin.skipDataQuery || plugin.hideFromList) {
        continue;
      }

      list.push({
        name: plugin.name,
        pluginId: plugin.id,
        description: plugin.info.description,
        cardOptions: {
          imgSrc: plugin.info.logos.small,
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
