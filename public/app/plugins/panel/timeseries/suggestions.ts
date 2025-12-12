import { defaultsDeep } from 'lodash';

import {
  DataFrameType,
  DataTransformerID,
  FieldType,
  PanelPluginVisualizationSuggestion,
  VisualizationSuggestion,
  VisualizationSuggestionScore,
  VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LegendDisplayMode,
  LineInterpolation,
  StackingMode,
} from '@grafana/schema';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { Options } from './panelcfg.gen';

const MAX_BARS = 100;
const MAX_ROWS_SMOOTH_CHART = 200;

const withDefaults = (
  suggestion: VisualizationSuggestion<Options, GraphFieldConfig>
): VisualizationSuggestion<Options, GraphFieldConfig> =>
  defaultsDeep(suggestion, {
    options: {
      legend: {
        calcs: [],
        displayMode: LegendDisplayMode.Hidden,
        placement: 'right',
        showLegend: false,
      },
    },
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    cardOptions: {
      previewModifier: (s) => {
        s.options!.disableKeyboardEvents = true;
        if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
          s.fieldConfig!.defaults.custom!.lineWidth = Math.max(s.fieldConfig!.defaults.custom!.lineWidth ?? 1, 2);
        }
      },
    },
  } satisfies VisualizationSuggestion<Options, GraphFieldConfig>);

const areaChart = (name: string, stacking?: StackingMode) => ({
  name,
  fieldConfig: {
    defaults: {
      custom: {
        fillOpacity: 25,
        ...(stacking ? { stacking: { mode: stacking, group: 'A' } } : {}),
      },
    },
    overrides: [],
  },
});

const barChart = (name: string, stacking?: StackingMode) => ({
  name,
  fieldConfig: {
    defaults: {
      custom: {
        drawStyle: GraphDrawStyle.Bars,
        fillOpacity: 100,
        lineWidth: 1,
        gradientMode: GraphGradientMode.Hue,
        ...(stacking ? { stacking: { mode: stacking, group: 'A' } } : {}),
      },
    },
    overrides: [],
  },
});

// TODO: all "gradient color scheme" suggestions have been removed. they will be re-added as part of the "styles" feature.

export const timeseriesSuggestionsSupplier: VisualizationSuggestionsSupplier<Options, GraphFieldConfig> = (
  dataSummary
) => {
  if (
    !dataSummary.hasFieldType(FieldType.time) ||
    !dataSummary.hasFieldType(FieldType.number) ||
    dataSummary.rowCountTotal < 2
  ) {
    return;
  }

  const score: VisualizationSuggestionScore =
    dataSummary.hasDataFrameType(DataFrameType.TimeSeriesLong) ||
    dataSummary.hasDataFrameType(DataFrameType.TimeSeriesWide) ||
    dataSummary.hasDataFrameType(DataFrameType.TimeSeriesMulti)
      ? VisualizationSuggestionScore.Good
      : VisualizationSuggestionScore.OK;

  const suggestions: Array<VisualizationSuggestion<Options, GraphFieldConfig>> = [
    {
      name: t('timeseries.suggestions.line', 'Line chart'),
    },
  ];

  if (dataSummary.rowCountMax < MAX_ROWS_SMOOTH_CHART) {
    suggestions.push({
      name: t('timeseries.suggestions.line-smooth', 'Line chart - smooth'),
      fieldConfig: {
        defaults: {
          custom: {
            lineInterpolation: LineInterpolation.Smooth,
          },
        },
        overrides: [],
      },
    });
  }

  // Single-series suggestions
  if (dataSummary.fieldCountByType(FieldType.number) === 1) {
    suggestions.push(areaChart(t('timeseries.suggestions.area', 'Area chart')));

    if (dataSummary.rowCountMax < MAX_BARS) {
      suggestions.push(barChart(t('timeseries.suggestions.bar', 'Bar chart')));
    }
  }
  // Multiple series suggestions
  else {
    suggestions.push(
      areaChart(t('timeseries.suggestions.area-stacked', 'Area chart - stacked'), StackingMode.Normal),
      areaChart(
        t('timeseries.suggestions.area-stacked-percentage', 'Area chart - stacked by percentage'),
        StackingMode.Percent
      )
    );

    if (dataSummary.rowCountTotal / dataSummary.fieldCountByType(FieldType.number) < MAX_BARS) {
      suggestions.push(
        barChart(t('timeseries.suggestions.bar-stacked', 'Bar chart - stacked'), StackingMode.Normal),
        barChart(
          t('timeseries.suggestions.bar-stacked-percent', 'Bar chart - stacked by percentage'),
          StackingMode.Percent
        )
      );
    }
  }

  return suggestions.map((s) => {
    s.score = score;
    return withDefaults(s);
  });
};

// This will try to get a suggestion that will add a long to wide conversion
export function getPrepareTimeseriesSuggestion(panelId: number): PanelPluginVisualizationSuggestion | undefined {
  const panel = getDashboardSrv().getCurrent()?.getPanelById(panelId);
  if (panel) {
    const transformations = panel.transformations ? [...panel.transformations] : [];
    transformations.push({
      id: DataTransformerID.prepareTimeSeries,
      options: {
        format: 'wide',
      },
    });

    return {
      name: 'Transform to wide time series format',
      hash: 'timeseries-transform-prepare-wide',
      pluginId: 'timeseries',
      transformations,
    };
  }
  return undefined;
}
