import { VisualizationSuggestionsBuilder, VisualizationSuggestionScore } from '@grafana/data';
import { Options } from '@grafana/schema/src/raw/composable/logs/panelcfg/x/LogsPanelCfg_types.gen';
import { SuggestionName } from 'app/types/suggestions';

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
