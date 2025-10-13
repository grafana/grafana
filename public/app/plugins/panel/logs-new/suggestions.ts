import { VisualizationSuggestionsBuilder, VisualizationSuggestionScore } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';

import { Options } from './panelcfg.gen';

export class LogsPanelSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<Options, {}>({
      name: '',
      pluginId: 'logs-new',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
    });

    const { dataSummary: ds } = builder;

    // Require a string & time field
    if (!ds.hasData || !ds.hasTimeField || !ds.hasStringField) {
      return;
    }

    if (ds.preferredVisualisationType === 'logs') {
      list.append({ name: SuggestionName.Logs, score: VisualizationSuggestionScore.Best });
    } else {
      list.append({ name: SuggestionName.Logs });
    }
  }
}
