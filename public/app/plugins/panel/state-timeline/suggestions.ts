import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';
import { TimelineFieldConfig, TimelineOptions } from './types';

export class StatTimelineSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData) {
      return;
    }

    // This panel needs a time field and a string or number field
    if (!dataSummary.hasTimeField || (!dataSummary.hasStringField && !dataSummary.hasNumberField)) {
      return;
    }

    // If there are many series then they won't fit on y-axis so this panel is not good fit
    if (dataSummary.numberFieldCount >= 30) {
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

    list.append({ name: SuggestionName.StateTimeline });
  }
}
