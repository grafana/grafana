import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SuggestionName } from 'app/types/suggestions';
import { prepareCandlestickFields } from './fields';
import { CandlestickOptions, defaultPanelOptions } from './models.gen';

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
    if (!info.open || info.warn || info.noTimeField) {
      return;
    }

    // Regular timeseries
    if (info.open === info.high && info.open === info.low) {
      return;
    }

    const list = builder.getListAppender<CandlestickOptions, {}>({
      name: '',
      pluginId: 'candlestick',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      previewModifier: (s) => {},
    });

    list.append({
      name: SuggestionName.Candlestick,
      options: defaultPanelOptions,
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    });
  }
}
