import { FieldColorModeId, VisualizationSuggestionsBuilder } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';
import { StatusPanelOptions, StatusFieldConfig } from './types';

export class StatusHistorySuggestionsSupplier {
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

    // if there a lot of data points for each series then this is not a good match
    if (dataSummary.rowCountMax > 100) {
      return;
    }

    const list = builder.getListAppender<StatusPanelOptions, StatusFieldConfig>({
      name: '',
      pluginId: 'status-history',
      options: {},
      fieldConfig: {
        defaults: {
          color: {
            mode: FieldColorModeId.ContinuousGrYlRd,
          },
          custom: {},
        },
        overrides: [],
      },
      previewModifier: (s) => {
        s.options!.colWidth = 0.7;
      },
    });

    list.append({ name: SuggestionName.StatusHistory });
  }
}
