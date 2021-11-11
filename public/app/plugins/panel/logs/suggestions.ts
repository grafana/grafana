import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';
import { Options } from './types';

export class LogsPanelSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<Options, {}>({
      name: '',
      pluginId: 'logs',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
      previewModifier: (s) => {},
    });

    const { dataSummary: ds } = builder;

    // Require a string & time field
    if (!ds.hasData || !ds.hasTimeField || !ds.hasStringField) {
      return;
    }

    if (ds.preferredVisualisationType === 'logs') {
      list.append({ name: SuggestionName.Logs, score: 100 });
    } else {
      list.append({ name: SuggestionName.Logs });
    }
  }
}
