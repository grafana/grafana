import { VisualizationSuggestionsBuilder } from '@grafana/data';

import { AlertListOptions } from './types';

export class AlertListSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (dataSummary.hasData) {
      return;
    }

    const list = builder.getListAppender<AlertListOptions, {}>({
      name: 'Dashboard list',
      pluginId: 'dashlist',
      options: {},
    });

    list.append({});
  }
}
