import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { BigValueColorMode, BigValueGraphMode } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';

import { Options } from './panelcfg.gen';

export class StatSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary: ds } = builder;

    if (!ds.hasData) {
      return;
    }

    const list = builder.getListAppender<Options, {}>({
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
      cardOptions: {
        previewModifier: (s) => {
          if (s.options!.reduceOptions.values) {
            s.options!.reduceOptions.limit = 1;
          }
        },
      },
    });

    // String and number field with low row count show individual rows
    if (ds.hasStringField && ds.hasNumberField && ds.frameCount === 1 && ds.rowCountTotal < 10) {
      list.append({
        name: SuggestionName.Stat,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
            fields: '/.*/',
          },
        },
      });
      list.append({
        name: SuggestionName.StatColoredBackground,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
            fields: '/.*/',
          },
          colorMode: BigValueColorMode.Background,
        },
      });
    }

    // Just a single string field
    if (ds.stringFieldCount === 1 && ds.frameCount === 1 && ds.rowCountTotal < 10 && ds.fieldCount === 1) {
      list.append({
        name: SuggestionName.Stat,
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
            fields: '/.*/',
          },
          colorMode: BigValueColorMode.None,
        },
      });
    }

    if (ds.hasNumberField && ds.hasTimeField) {
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
