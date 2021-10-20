import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { TimelineFieldConfig, TimelineOptions } from './types';

export class StatTimelineSuggestionsSupplier {
  getSuggestions(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<TimelineOptions, TimelineFieldConfig>({
      name: 'State timeline',
      pluginId: 'state-timeline',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      previewModifier: (s) => {},
    });

    const { dataSummary } = builder;

    // This panel needs a time field and a string or number field
    if (!dataSummary.hasTimeField || (!dataSummary.hasStringField && !dataSummary.hasNumberField)) {
      return;
    }

    list.append({});
  }
}
