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
      cardOptions: {
        imgSrc: 'public/app/plugins/panel/text/img/icn-text-panel.svg',
      },
    });

    list.append({});
  }
}
