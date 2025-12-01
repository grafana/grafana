import {
  PanelData,
  PanelPluginVisualizationSuggestion,
  VisualizationSuggestionsBuilder,
  PanelModel,
  VisualizationSuggestionScore,
  PreferredVisualisationType,
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
  'heatmap',
  'histogram',
  'geomap',
];

/**
 * some of the PreferredVisualisationTypes do not match the panel plugin ids, so we have to map them. d'oh.
 */
const PLUGIN_ID_TO_PREFERRED_VIZ_TYPE: Record<string, PreferredVisualisationType> = {
  traces: 'trace',
  timeseries: 'graph',
  table: 'table',
  logs: 'logs',
  nodeGraph: 'nodeGraph',
  flamegraph: 'flamegraph',
};
const mapPreferredVisualisationTypeToPlugin = (type: string): PreferredVisualisationType | undefined => {
  return PLUGIN_ID_TO_PREFERRED_VIZ_TYPE[type];
};

export async function getAllSuggestions(
  data?: PanelData,
  panel?: PanelModel
): Promise<PanelPluginVisualizationSuggestion[]> {
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
        hash: 'plugin-empty-' + plugin.id,
        cardOptions: {
          imgSrc: plugin.info.logos.small,
        },
      });
    }
  }

  return list.sort((a, b) => {
    const mappedA = mapPreferredVisualisationTypeToPlugin(a.pluginId);
    if (mappedA && builder.dataSummary.hasPreferredVisualisationType(mappedA)) {
      return -1;
    }
    const mappedB = mapPreferredVisualisationTypeToPlugin(a.pluginId);
    if (mappedB && builder.dataSummary.hasPreferredVisualisationType(mappedB)) {
      return 1;
    }
    return (b.score ?? VisualizationSuggestionScore.OK) - (a.score ?? VisualizationSuggestionScore.OK);
  });
}
