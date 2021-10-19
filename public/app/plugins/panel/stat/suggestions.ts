import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { StatPanelOptions } from './types';

export class StatSuggestionsSupplier {
  getSuggestions(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<StatPanelOptions, {}>({
      name: 'Stat',
      pluginId: 'stat',
      options: {},
      fieldConfig: {
        defaults: {
          unit: 'short',
          custom: {},
        },
        overrides: [],
      },
      previewModifier: (s) => {
        if (s.options!.reduceOptions.values) {
          s.options!.reduceOptions.limit = 1;
        }
      },
    });
    const { dataSummary } = builder;

    if (dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
      list.append({
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
          },
        },
      });
    } else {
      list.append({
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
        },
      });
    }
  }
}
