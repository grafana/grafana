import { defaultsDeep } from 'lodash';

import { FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BigValueColorMode, BigValueGraphMode } from '@grafana/schema';

import { Options } from './panelcfg.gen';

const withDefaults = (s: VisualizationSuggestion<Options>): VisualizationSuggestion<Options> =>
  defaultsDeep(s, {
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
  } satisfies VisualizationSuggestion<Options>);

export const statSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (ds) => {
  if (!ds.hasData) {
    return;
  }

  const suggestions: Array<VisualizationSuggestion<Options>> = [];

  // String and number field with low row count show individual rows
  if (
    ds.hasFieldType(FieldType.string) &&
    ds.hasFieldType(FieldType.number) &&
    ds.frameCount === 1 &&
    ds.rowCountTotal < 10
  ) {
    suggestions.push(
      {
        name: t('stat.suggestions.stat-discrete-values', 'Stat - discrete values'),
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
            fields: '/.*/',
          },
        },
      },
      {
        name: t('stat.suggestions.stat-discrete-values-color-background', 'Stat - discrete values - color background'),
        options: {
          reduceOptions: {
            values: true,
            calcs: [],
            fields: '/.*/',
          },
          colorMode: BigValueColorMode.Background,
        },
      }
    );
  }

  // just a single string field
  if (ds.fieldCount === 1 && ds.hasFieldType(FieldType.string)) {
    suggestions.push({
      name: t('stat.suggestions.stat-single-string', 'Stat - single string'),
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

  // aggregated suggestions for number fields
  if (ds.hasFieldType(FieldType.number) && ds.hasFieldType(FieldType.time)) {
    suggestions.push(
      {
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
        },
      },
      {
        name: t('stat.suggestions.stat-color-background', 'Stat - color background'),
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
          graphMode: BigValueGraphMode.None,
          colorMode: BigValueColorMode.Background,
        },
      }
    );
  }

  return suggestions.map(withDefaults);
};
