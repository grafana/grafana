import { FieldType, VisualizationSuggestionScore, VisualizationSuggestionsSupplierFn } from '@grafana/data';
import { config } from '@grafana/runtime';

import { prepareCandlestickFields } from './fields';
import { defaultOptions, Options } from './types';

export const candlestickSuggestionSupplier: VisualizationSuggestionsSupplierFn<Options> = (dataSummary) => {
  if (
    !dataSummary._data ||
    !dataSummary.hasData ||
    dataSummary.fieldCountByType(FieldType.time) < 1 ||
    dataSummary.fieldCountByType(FieldType.number) < 2 ||
    dataSummary.fieldCountByType(FieldType.number) > 10
  ) {
    return;
  }

  const info = prepareCandlestickFields(dataSummary._data, defaultOptions, config.theme2);
  if (!info) {
    return;
  }

  // Regular timeseries
  if (info.open === info.high && info.open === info.low) {
    return;
  }

  return [{ score: info.autoOpenClose ? VisualizationSuggestionScore.Good : VisualizationSuggestionScore.Best }];
};
