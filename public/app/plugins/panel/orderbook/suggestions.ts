import { FieldType, type VisualizationSuggestionsSupplier, VisualizationSuggestionScore } from '@grafana/data';
import { config } from '@grafana/runtime';

import { defaultOptions, type Options } from './types';
import { prepareOrderBook } from './utils';

const MAX_PREVIEW_SERIES = 4;

export const orderBookSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (dataSummary) => {
  if (!dataSummary.hasData || !dataSummary.rawFrames || dataSummary.fieldCountByType(FieldType.number) < 2) {
    return;
  }

  // Only suggest when the data actually parses into a usable order book.
  const book = prepareOrderBook(dataSummary.rawFrames, defaultOptions, config.theme2);
  if (!book || (book.asks.length === 0 && book.bids.length === 0)) {
    return;
  }

  return [
    {
      score: VisualizationSuggestionScore.OK,
      cardOptions: {
        maxSeries: MAX_PREVIEW_SERIES,
      },
    },
  ];
};
