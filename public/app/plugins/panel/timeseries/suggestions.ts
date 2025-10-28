import {
  FieldColorModeId,
  VisualizationSuggestionsBuilder,
  VisualizationSuggestion,
  DataTransformerID,
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

export class TimeSeriesSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasTimeField || !dataSummary.hasNumberField || dataSummary.rowCountTotal < 2) {
      return;
    }

    const list = builder.getListAppender<Options, GraphFieldConfig>({
      name: t('timeseries.suggestions.line', 'Line chart'),
      pluginId: 'timeseries',
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
          if (s.fieldConfig?.defaults.custom?.drawStyle !== GraphDrawStyle.Bars) {
            s.fieldConfig!.defaults.custom!.lineWidth = Math.max(s.fieldConfig!.defaults.custom!.lineWidth ?? 1, 2);
          }
        },
      },
    });

    const maxBarsCount = 100;

    list.append({
      name: t('timeseries.suggestions.line', 'Line chart'),
    });

    if (dataSummary.rowCountMax < 200) {
      list.append({
        name: t('timeseries.suggestions.line-smooth', 'Line chart (smooth)'),
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

    // Single series suggestions
    if (dataSummary.numberFieldCount === 1) {
      list.append({
        name: t('timeseries.suggestions.area', 'Area chart'),
        fieldConfig: {
          defaults: {
            custom: {
              fillOpacity: 25,
            },
          },
          overrides: [],
        },
      });

      list.append({
        name: t('timeseries.suggestions.line-gradient', 'Line chart (with gradient color scheme)'),
        fieldConfig: {
          defaults: {
            color: {
              mode: FieldColorModeId.ContinuousGrYlRd,
            },
            custom: {
              gradientMode: GraphGradientMode.Scheme,
              lineInterpolation: LineInterpolation.Smooth,
              lineWidth: 3,
              fillOpacity: 20,
            },
          },
          overrides: [],
        },
      });

      if (dataSummary.rowCountMax < maxBarsCount) {
        list.append({
          name: t('timeseries.suggestions.bar', 'Bar chart'),
          fieldConfig: {
            defaults: {
              custom: {
                drawStyle: GraphDrawStyle.Bars,
                fillOpacity: 100,
                lineWidth: 1,
                gradientMode: GraphGradientMode.Hue,
              },
            },
            overrides: [],
          },
        });

        list.append({
          name: t('timeseries.suggestions.bar-gradient', 'Bar chart (with gradient color scheme)'),
          fieldConfig: {
            defaults: {
              color: {
                mode: FieldColorModeId.ContinuousGrYlRd,
              },
              custom: {
                drawStyle: GraphDrawStyle.Bars,
                fillOpacity: 90,
                lineWidth: 1,
                gradientMode: GraphGradientMode.Scheme,
              },
            },
            overrides: [],
          },
        });
      }

      return;
    }

    // Multiple series suggestions

    list.append({
      name: t('timeseries.suggestions.area-stacked', 'Area chart (stacked)'),
      fieldConfig: {
        defaults: {
          custom: {
            fillOpacity: 25,
            stacking: {
              mode: StackingMode.Normal,
              group: 'A',
            },
          },
        },
        overrides: [],
      },
    });

    list.append({
      name: t('timeseries.suggestions.area-stacked-percent', 'Area chart (100%, stacked)'),
      fieldConfig: {
        defaults: {
          custom: {
            fillOpacity: 25,
            stacking: {
              mode: StackingMode.Percent,
              group: 'A',
            },
          },
        },
        overrides: [],
      },
    });

    if (dataSummary.rowCountTotal / dataSummary.numberFieldCount < maxBarsCount) {
      list.append({
        name: t('timeseries.suggestions.area-stacked-percent', 'Bar chart (stacked)'),
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: GraphDrawStyle.Bars,
              fillOpacity: 100,
              lineWidth: 1,
              gradientMode: GraphGradientMode.Hue,
              stacking: {
                mode: StackingMode.Normal,
                group: 'A',
              },
            },
          },
          overrides: [],
        },
      });

      list.append({
        name: t('timeseries.suggestions.bar-stacked-percent', 'Bar chart (100%, stacked)'),
        fieldConfig: {
          defaults: {
            custom: {
              drawStyle: GraphDrawStyle.Bars,
              fillOpacity: 100,
              lineWidth: 1,
              gradientMode: GraphGradientMode.Hue,
              stacking: {
                mode: StackingMode.Percent,
                group: 'A',
              },
            },
          },
          overrides: [],
        },
      });
    }
  }
}

// This will try to get a suggestion that will add a long to wide conversion
export function getPrepareTimeseriesSuggestion(panelId: number): VisualizationSuggestion | undefined {
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
      name: t('timeseries.suggestions.wide-timeseries', 'Transform to wide time series format'),
      pluginId: 'timeseries',
      transformations,
    };
  }
  return undefined;
}
