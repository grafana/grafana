import { VisualizationSuggestionsBuilder, VisualizationSuggestionScore } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SuggestionName } from 'app/types/suggestions';

import { prepareCandlestickFields } from './fields';
import { PanelOptions } from './panelcfg.gen';
import { defaultPanelOptions } from './types';

export class CandlestickSuggestionsSupplier {
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

    const info = prepareCandlestickFields(builder.data.series, defaultPanelOptions, config.theme2);
    if (!info) {
      return;
    }

    // Regular timeseries
    if (info.open === info.high && info.open === info.low) {
      return;
    }

    const list = builder.getListAppender<PanelOptions, {}>({
      name: '',
      pluginId: 'candlestick',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
    });

    list.append({
      name: SuggestionName.Candlestick,
      options: defaultPanelOptions,
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      score: info.autoOpenClose ? VisualizationSuggestionScore.Good : VisualizationSuggestionScore.Best,
    });
  }
}
