import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Options } from '@grafana/schema/src/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';

import { prepareHeatmapData } from './fields';
import { defaultOptions } from './types';

export class HeatmapSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (
      !builder.data?.series ||
      !dataSummary.hasData ||
      dataSummary.timeFieldCount < 1 ||
      dataSummary.numberFieldCount < 2 ||
      dataSummary.numberFieldCount > 10
    ) {
      return;
    }

    const info = prepareHeatmapData(builder.data.series, undefined, defaultOptions, config.theme2);
    if (!info || info.warning) {
      return;
    }

    builder.getListAppender<Options, {}>({
      name: '',
      pluginId: 'heatmap',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
    });
  }
}
