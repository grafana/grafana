import { VisualizationSuggestionsBuilder, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';

import { FieldConfig, Options } from './panelcfg.gen';

export class StatTimelineSuggestionsSupplier implements VisualizationSuggestionsSupplier<Options, FieldConfig> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options, FieldConfig>({
      name: t('state-timeline.suggestions.name', 'State timeline'),
      pluginId: 'state-timeline',
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary: ds } = builder;

    if (!ds.hasData) {
      return;
    }

    // This panel needs a time field and a string or number field
    if (!ds.hasTimeField || (!ds.hasStringField && !ds.hasNumberField)) {
      return;
    }

    // If there are many series then they won't fit on y-axis so this panel is not good fit
    if (ds.numberFieldCount >= 30) {
      return;
    }

    // Probably better ways to filter out this by inspecting the types of string values so view this as temporary
    if (ds.preferredVisualisationType === 'logs') {
      return;
    }

    this.getListAppender(builder).append({});
  }
}
