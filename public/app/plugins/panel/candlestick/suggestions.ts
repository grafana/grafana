import { VisualizationSuggestionsBuilder, VisualizationSuggestionScore } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { prepareCandlestickFields } from './fields';
import { defaultOptions, Options } from './types';

export class CandlestickSuggestionsSupplier {
  getListWithDefaults(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options, {}>({
      name: t('candlestick.suggestions.name', 'Candlestick chart'),
      pluginId: 'candlestick',
    });
  }

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

    const info = prepareCandlestickFields(builder.data.series, defaultOptions, config.theme2);
    if (!info) {
      return;
    }

    // Regular timeseries
    if (info.open === info.high && info.open === info.low) {
      return;
    }

    this.getListWithDefaults(builder).append({
      options: defaultOptions,
      score: info.autoOpenClose ? VisualizationSuggestionScore.Good : VisualizationSuggestionScore.Best,
    });
  }
}
