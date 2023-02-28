import { VisualizationSuggestionsBuilder } from '@grafana/data';
import { config } from '@grafana/runtime';

import { prepareHeatmapData } from './fields';
import { PanelOptions, defaultPanelOptions } from './panelcfg.gen';

export class HeatmapSuggestionsSupplier {
  getSuggestionsForData(builder: VisualizationSuggestionsBuilder) {
    const { dataSummary } = builder;

    if (
      !builder.data?.series ||
      !dataSummary.hasData ||
      dataSummary.timeFieldCount < 1 ||
      dataSummary.numberFieldCount < 2 ||
      dataSummary.numberFieldCount > 10
    ) {
      return;
    }

    //avoid type assertion
    const panelOptions: PanelOptions = {
      ...defaultPanelOptions,
      calculation: defaultPanelOptions.calculation!,
      cellValues: defaultPanelOptions.cellValues!,
      color: defaultPanelOptions.color!,
      tooltip: defaultPanelOptions.tooltip!,
      legend: defaultPanelOptions.legend!,
      yAxis: defaultPanelOptions.yAxis!,
      exemplars: defaultPanelOptions.exemplars!,
      filterValues: defaultPanelOptions.filterValues!,
      rowsFrame: defaultPanelOptions.rowsFrame!,
      showValue: defaultPanelOptions.showValue!,
    };

    const info = prepareHeatmapData(builder.data, panelOptions, config.theme2);
    if (!info || info.warning) {
      return;
    }

    builder.getListAppender<PanelOptions, {}>({
      name: '',
      pluginId: 'heatmap',
      options: {},
      fieldConfig: {
        defaults: {
          custom: {},
        },
        overrides: [],
      },
    });
  }
}
