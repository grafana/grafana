import { FieldType, VisualizationSuggestionScore, VisualizationSuggestionsSupplier } from '@grafana/data';
import { t } from '@grafana/i18n';
<<<<<<< HEAD

import { Options, FieldConfig } from './panelcfg.gen';

export const xychartSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, FieldConfig> = (ds) => {
  if (ds.fieldCountByType(FieldType.number) < 2) {
=======
import { config } from '@grafana/runtime';

import { Options, FieldConfig, SeriesMapping } from './panelcfg.gen';
import { prepConfig } from './scatter';
import { prepSeries } from './utils';

export const xychartSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, FieldConfig> = (ds) => {
  if (!ds.rawFrames) {
    return;
  }

  const fieldConfig = { defaults: {}, overrides: [] };
  // check if an Auto mapping would yield valid x/y series
  const series = prepSeries(SeriesMapping.Auto, [], ds.rawFrames, fieldConfig);
  const { builder, prepData } = prepConfig(series, config.theme2);
  const data = prepData(series);
  if (builder == null || data.length === 0) {
>>>>>>> 38b0ce3ca63 (Suggestions: Add XYChart implementation)
    return;
  }

  return [
    {
      name: t('xychart.suggestions.scatter-plot', 'Scatter plot'),
<<<<<<< HEAD
=======
      options: {},
      fieldConfig,
>>>>>>> 38b0ce3ca63 (Suggestions: Add XYChart implementation)
      score: ds.hasFieldType(FieldType.time) ? VisualizationSuggestionScore.OK : VisualizationSuggestionScore.Good,
    },
  ];
};
