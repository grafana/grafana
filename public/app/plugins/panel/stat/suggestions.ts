import { VisualizationSuggestionsBuilder, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BigValueColorMode, BigValueGraphMode, GraphFieldConfig } from '@grafana/schema';

import { Options } from './panelcfg.gen';

export class StatSuggestionsSupplier implements VisualizationSuggestionsSupplier<Options, GraphFieldConfig> {
  getListAppender(builder: VisualizationSuggestionsBuilder) {
    return builder.getListAppender<Options, GraphFieldConfig>({
      name: t('stat.suggestions.name', 'Stat'),
      pluginId: 'stat',
      options: {
        reduceOptions: {
          values: false,
          calcs: ['lastNotNull'],
        },
      },
      fieldConfig: {
        defaults: {
          unit: 'short',
          custom: {},
        },
        overrides: [],
      },
      cardOptions: {
        previewModifier: (s) => {
          if (s.options?.reduceOptions?.values) {
            s.options.reduceOptions.limit = 1;
          }
        },
      },
    });
  }

  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary: ds } = builder;

    if (!ds.hasData) {
      return;
    }

    const list = this.getListAppender(builder);

    // String and number field with low row count show individual rows
    let optionsOverride: Partial<Options> = {};
    if (ds.hasStringField && ds.frameCount === 1 && ds.rowCountTotal < 10) {
      optionsOverride.reduceOptions = {
        values: true,
        calcs: [],
        fields: '/.*/',
      };

      // Just a single string field
      if (ds.fieldCount === 1) {
        list.append({
          options: {
            colorMode: BigValueColorMode.None,
            ...optionsOverride,
          },
        });
      }
    }

    if (ds.hasNumberField) {
      list.append({ options: optionsOverride });
      list.append({
        name: t('stat.suggestions.stat-colored', 'Stat (colored background)'),
        options: {
          graphMode: BigValueGraphMode.None,
          colorMode: BigValueColorMode.Background,
          ...optionsOverride,
        },
      });
    }
  }
}
