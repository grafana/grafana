import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { PanelOptions, PanelFieldConfig } from './models.gen';

export class TableSuggestionsSupplier {
  getSuggestions(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<PanelOptions, PanelFieldConfig>({
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

    list.append({});
  }
}
