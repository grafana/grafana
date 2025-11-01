import {
  VisualizationSuggestionsBuilder,
  VisualizationSuggestionScore,
  VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { Options } from './types';

export class TracesSuggestionsSupplier implements VisualizationSuggestionsSupplier<Options> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options>({
      name: t('traces.suggestions.name', 'Trace'),
      pluginId: 'traces',
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    if (!builder.data || builder.dataSummary.frameCount === 0) {
      return;
    }

    if (builder.data.series[0].meta?.preferredVisualisationType === 'trace') {
      this.getListAppender(builder).append({
        score: VisualizationSuggestionScore.Best,
      });
    }
  }
}
