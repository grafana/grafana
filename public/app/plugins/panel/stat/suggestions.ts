import { VisualizationSuggestionBuilderUtil, VisualizationSuggestionsInput } from '@grafana/data';
import { StatPanelOptions } from './types';

export function getSuggestions({ data }: VisualizationSuggestionsInput) {
  if (!data || !data.series || data.series.length === 0) {
    return null;
  }

  const frames = data.series;
  const builder = new VisualizationSuggestionBuilderUtil<StatPanelOptions, {}>({
    name: 'Stat',
    pluginId: 'stat',
    options: {},
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    previewModifier: (s) => {
      if (s.options!.reduceOptions.values) {
        s.options!.reduceOptions.limit = 2;
      }
    },
  });

  if (frames.length === 1 && frames[0].length < 5) {
    builder.add({
      options: {
        reduceOptions: {
          values: true,
          calcs: [],
        },
      },
    });
  } else {
    builder.add({
      options: {
        reduceOptions: {
          values: false,
          calcs: ['lastNotNull'],
        },
      },
    });
  }

  return builder.getList();
}
