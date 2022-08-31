import { FieldColorModeId, VisualizationSuggestionsBuilder } from '@grafana/data';
import { SuggestionName } from 'app/types/suggestions';

import { StatusPanelOptions, StatusFieldConfig } from './types';

export class StatusHistorySuggestionsSupplier {
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

    // if there a lot of data points for each series then this is not a good match
    if (ds.rowCountMax > 100) {
      return;
    }

    // Probably better ways to filter out this by inspecting the types of string values so view this as temporary
    if (ds.preferredVisualisationType === 'logs') {
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
      cardOptions: {
        previewModifier: (s) => {
          s.options!.colWidth = 0.7;
        },
      },
    });

    list.append({ name: SuggestionName.StatusHistory });
  }
}
