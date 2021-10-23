import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode } from '@grafana/ui';
import { SuggestionName } from 'app/types/suggestions';
import { StatPanelOptions } from './types';

export class StatSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasData) {
      return;
    }

    const list = builder.getListAppender<StatPanelOptions, {}>({
      name: SuggestionName.Stat,
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

    if (dataSummary.hasStringField && dataSummary.frameCount === 1 && dataSummary.rowCountTotal < 10) {
      list.append({
        name: SuggestionName.Stat,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
            fields: dataSummary.hasNumberField ? undefined : '/.*/',
          },
        },
      });
      list.append({
        name: SuggestionName.StatColoredBackground,
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
        name: SuggestionName.StatColoredBackground,
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
