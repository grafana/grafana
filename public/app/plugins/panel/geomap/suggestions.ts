import {
  FieldType,
  VisualizationSuggestionsBuilder,
  VisualizationSuggestionScore,
  VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { Options } from './panelcfg.gen';

export class GeomapSuggestionSupplier implements VisualizationSuggestionsSupplier<Options> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<{}>({
      name: t('geomap.suggestions.name', 'Geomap'),
      pluginId: 'geomap',
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    if (!builder.data) {
      return;
    }

    if (!builder.dataSummary.hasFieldType(FieldType.geo)) {
      return;
    }

    this.getListAppender(builder).append({
      score: VisualizationSuggestionScore.Best,
    });
  }
}
