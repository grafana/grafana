import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { TableFieldOptions } from '@grafana/schema';
import { SuggestionName } from 'app/types/suggestions';
import { PanelOptions } from './models.gen';

export class TableSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const list = builder.getListAppender<PanelOptions, TableFieldOptions>({
      name: '',
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

    list.append({ name: SuggestionName.Table });
  }
}
