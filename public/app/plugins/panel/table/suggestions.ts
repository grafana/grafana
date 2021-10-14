import { VisualizationSuggestionBuilderUtil, VisualizationSuggestionsInput } from '@grafana/data';
import { PanelOptions, PanelFieldConfig } from './models.gen';

export function getSuggestions({ data }: VisualizationSuggestionsInput) {
  if (!data || !data.series || data.series.length === 0) {
    return [];
  }

  const frames = data.series;
  const builder = new VisualizationSuggestionBuilderUtil<PanelOptions, PanelFieldConfig>({
    name: 'Table',
    pluginId: 'table',
    options: {},
    fieldConfig: {
      defaults: {
        custom: {},
      },
      overrides: [],
    },
    previewModifier: (s) => {},
  });

  if (frames.length === 1) {
    builder.add({});
  }

  return builder.getList();
}
