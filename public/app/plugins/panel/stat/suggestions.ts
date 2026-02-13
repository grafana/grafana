import { defaultsDeep } from 'lodash';

import { FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BigValueColorMode, BigValueGraphMode } from '@grafana/schema';
import { defaultNumericVizOptions } from 'app/features/panel/suggestions/utils';

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

const MAX_STATS = 50;

export const statSuggestionsSupplier: VisualizationSuggestionsSupplier<Options> = (ds) => {
  if (!ds.hasData) {
    return;
  }
  if (ds.rowCountTotal > MAX_STATS) {
    return;
  }

  const suggestions: Array<VisualizationSuggestion<Options>> = [];
  let shouldUseRawValues = false;

  if (ds.fieldCount === 1 && ds.hasFieldType(FieldType.string)) {
    // just a single string field
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
  } else if (ds.hasFieldType(FieldType.number) && ds.hasFieldType(FieldType.time)) {
    // aggregated suggestions for number fields
    suggestions.push(
      {
        name: t('stat.suggestions.stat', 'Stat'),
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
  } else if (ds.hasFieldType(FieldType.string) && ds.hasFieldType(FieldType.number) && ds.frameCount === 1) {
    // String and number field with low row count show individual rows
    shouldUseRawValues = true;
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

  return suggestions.map((s) => defaultNumericVizOptions(withDefaults(s), ds, shouldUseRawValues));
};
