import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { PanelOptions } from './models.gen';

export class TextPanelSuggestionSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (dataSummary.hasData) {
      return;
    }

    const list = builder.getListAppender<PanelOptions, {}>({
      name: 'Text panel',
      pluginId: 'text',
      options: {
        content: `
# Title

For markdown syntax help: [commonmark.org/help](https://commonmark.org/help/)

* First item
* Second item
* Third item`,
      },
    });

    list.append({});
  }
}
