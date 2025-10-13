import {
  FieldColorModeId,
  VisualizationSuggestionsBuilder,
  VisualizationSuggestion,
  DataTransformerID,
} from '@grafana/data';
import {
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LegendDisplayMode,
  LineInterpolation,
  StackingMode,
} from '@grafana/schema';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { SuggestionName } from 'app/types/suggestions';

import { Options } from './panelcfg.gen';

export class TimeSeriesSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (!dataSummary.hasTimeField || !dataSummary.hasNumberField || dataSummary.rowCountTotal < 2) {
      return;
    }

    const list = builder.getListAppender<Options, GraphFieldConfig>({
      name: SuggestionName.LineChart,
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
      name: SuggestionName.LineChart,
    });

    if (dataSummary.rowCountMax < 200) {
      list.append({
        name: SuggestionName.LineChartSmooth,
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
        name: SuggestionName.AreaChart,
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
        name: SuggestionName.LineChartGradientColorScheme,
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
          name: SuggestionName.BarChart,
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
          name: SuggestionName.BarChartGradientColorScheme,
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
      name: SuggestionName.AreaChartStacked,
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
      name: SuggestionName.AreaChartStackedPercent,
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
        name: SuggestionName.BarChartStacked,
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
        name: SuggestionName.BarChartStackedPercent,
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
      name: 'Transform to wide time series format',
      pluginId: 'timeseries',
      transformations,
    };
  }
  return undefined;
}
