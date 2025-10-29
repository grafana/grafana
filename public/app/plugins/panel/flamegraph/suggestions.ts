import { VisualizationSuggestionsBuilder, VisualizationSuggestionsSupplier } from '@grafana/data';
import { checkFields } from '@grafana/flamegraph';
import { t } from '@grafana/i18n';

export class FlameGraphSuggestionsSupplier implements VisualizationSuggestionsSupplier<{}> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<{}>({
      name: t('flamegraph.suggestions.name', 'Flame graph'),
      pluginId: 'flamegraph',
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    if (!builder.data) {
      return;
    }

    const dataFrame = builder.data.series[0];
    if (!dataFrame) {
      return;
    }
    const wrongFields = checkFields(dataFrame);
    if (wrongFields) {
      return;
    }

    this.getListAppender(builder).append({});
  }
}
