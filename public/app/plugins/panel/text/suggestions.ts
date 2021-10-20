import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { PanelOptions } from './models.gen';

export class TextPanelSuggestionSupplier {
  getSuggestions(builder: VisualizationSuggestionsBuilder) {
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

### Table example

| Tables        | Are           | Cool  |
| ------------- |:-------------:| -----:|
| col 3 is      | right-aligned | $1600 |
| col 2 is      | centered      |   $12 |
| zebra stripes | are neat      |    $1 |`,
      },
    });

    list.append({});
  }
}
