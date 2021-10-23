import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { PanelOptions } from './models.gen';

export class DashListSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (dataSummary.hasData) {
      return;
    }

    const list = builder.getListAppender<PanelOptions, {}>({
      name: 'Dashboard list',
      pluginId: 'dashlist',
      options: {},
    });

    list.append({});
  }
}
