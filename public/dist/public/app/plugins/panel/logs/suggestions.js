import { VisualizationSuggestionScore } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';
export class LogsPanelSuggestionsSupplier {
    getSuggestionsForData(builder) {
        const list = builder.getListAppender({
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
        }
        else {
            list.append({ name: SuggestionName.Logs });
        }
    }
}
//# sourceMappingURL=suggestions.js.map