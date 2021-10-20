import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode } from '@grafana/ui';
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

    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
      list.append({
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
            fields: dataSummary.hasNumberField ? undefined : '/.*/',
          },
        },
      });
      list.append({
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
            fields: dataSummary.hasNumberField ? undefined : '/.*/',
          },
          colorMode: BigValueColorMode.Background,
        },
      });
    } else if (dataSummary.hasNumberField) {
      list.append({
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
        },
      });

      list.append({
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
          graphMode: BigValueGraphMode.None,
          colorMode: BigValueColorMode.Background,
        },
      });
    }
  }
}
