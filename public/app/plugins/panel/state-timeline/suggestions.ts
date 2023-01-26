import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';

import { PanelFieldConfig, PanelOptions } from './panelcfg.gen';

export class StatTimelineSuggestionsSupplier {
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

    const list = builder.getListAppender<PanelOptions, PanelFieldConfig>({
      name: '',
      pluginId: 'state-timeline',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
    });

    list.append({ name: SuggestionName.StateTimeline });
  }
}
