import { defaultsDeep } from 'lodash';

import { FieldType, VisualizationSuggestion, VisualizationSuggestionsSupplierFn } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BigValueColorMode, BigValueGraphMode } from '@grafana/schema';

import { Options } from './panelcfg.gen';

export const statSuggestionsSupplier: VisualizationSuggestionsSupplierFn<Options> = (ds) => {
  if (!ds.hasData) {
    return;
  }

  const withDefaults = (s: VisualizationSuggestion<Options>): VisualizationSuggestion<Options> =>
    defaultsDeep(s, {
      options: {
        reduceOptions: {
          values: true,
          calcs: [],
          fields: '/.*/',
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
    } satisfies VisualizationSuggestion<Options>);

  const valuesReduceOptions: Options['reduceOptions'] = {
    values: true,
    calcs: [],
    fields: '/.*/',
  };
  const aggregatedReduceOptions: Options['reduceOptions'] = {
    values: false,
    calcs: ['lastNotNull'],
  };

  const result: Array<VisualizationSuggestion<Options>> = [];

  // TODO: color background will be a style.

  // String and number field with low row count show individual rows
  if (
    ds.hasFieldType(FieldType.string) &&
    ds.hasFieldType(FieldType.number) &&
    ds.frameCount === 1 &&
    ds.rowCountTotal < 10
  ) {
    result.push(
      {
        name: t('stat.suggestions.stat-discrete-values', 'Stat - discrete values'),
        options: {
          reduceOptions: valuesReduceOptions,
        },
      },
      {
        name: t('stat.suggestions.stat-discrete-values-color-background', 'Stat - discrete values - color background'),
        options: {
          reduceOptions: valuesReduceOptions,
          colorMode: BigValueColorMode.Background,
        },
      }
    );
  }

  // just a single string field
  if (ds.fieldCount === 1 && ds.hasFieldType(FieldType.string)) {
    result.push({
      name: t('stat.suggestions.stat-single-string', 'Stat - single string'),
      options: {
        reduceOptions: valuesReduceOptions,
        colorMode: BigValueColorMode.None,
      },
    });
  }

  if (ds.hasFieldType(FieldType.number) && ds.hasFieldType(FieldType.time)) {
    result.push(
      {
        options: {
          reduceOptions: aggregatedReduceOptions,
        },
      },
      {
        name: t('stat.suggestions.stat-aggregated-color-background', 'Stat - color background'),
        options: {
          reduceOptions: aggregatedReduceOptions,
          graphMode: BigValueGraphMode.None,
          colorMode: BigValueColorMode.Background,
        },
      }
    );
  }

  return result.map(withDefaults);
};
