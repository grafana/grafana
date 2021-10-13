import { VisualizationSuggestion, VisualizationSuggestionsInput } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';
import { defaultsDeep } from 'lodash';
import { PieChartOptions, PieChartType } from './types';

type PieSuggestion = VisualizationSuggestion<Partial<PieChartOptions>>;

export function suggestionsSupplier({ data }: VisualizationSuggestionsInput) {
  const suggestions: PieSuggestion[] = [];

  if (!data || !data.series || data.series.length === 0) {
    return [];
  }

  const frames = data.series;
  const defaults: PieSuggestion = {
    name: 'Piechart',
    pluginId: 'piechart',
    options: {
      reduceOptions: {
        values: true,
        calcs: [],
      },
      legend: {
        displayMode: LegendDisplayMode.Hidden,
        placement: 'right',
      } as any,
    },
  };

  function buildSuggestion(
    overrides: Partial<VisualizationSuggestion<Partial<PieChartOptions>>>
  ): VisualizationSuggestion<PieChartOptions> {
    return defaultsDeep(overrides, defaults);
  }

  if (frames.length === 1) {
    suggestions.push(buildSuggestion({}));
    suggestions.push(
      buildSuggestion({
        name: 'Piechart donut',
        options: {
          pieType: PieChartType.Donut,
        },
      })
    );
  }

  if (frames.length > 1 && frames.length < 30) {
    suggestions.push(
      buildSuggestion({
        options: {
          reduceOptions: {
            values: false,
            calcs: ['lastNotNull'],
          },
        },
      })
    );
  }

  return suggestions;
}
