import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';
import { TimelineFieldConfig, TimelineOptions } from './types';

export class StatTimelineSuggestionsSupplier {
  getSuggestions(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData) {
      return;
    }

    const list = builder.getListAppender<TimelineOptions, TimelineFieldConfig>({
      name: '',
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

    // This panel needs a time field and a string or number field
    if (!dataSummary.hasTimeField || (!dataSummary.hasStringField && !dataSummary.hasNumberField)) {
      return;
    }

    list.append({ name: SuggestionName.StateTimeline });
  }
}
