import { FieldColorModeId, FieldConfigProperty, FieldMatcherID, PanelModel } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/schema';

import { Options, PieChartLabels, PieChartLegendValues, PieChartType } from './panelcfg.gen';

export const PieChartPanelChangedHandler = (
  panel: PanelModel<Partial<Options>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  if (prevPluginId === 'grafana-piechart-panel' && prevOptions.angular) {
    const angular = prevOptions.angular;
    const overrides = [];
    let options: Options = panel.options;

    // Migrate color overrides for series
    if (angular.aliasColors) {
      for (const alias of Object.keys(angular.aliasColors)) {
        const color = angular.aliasColors[alias];
        if (color) {
          overrides.push({
            matcher: {
              id: FieldMatcherID.byName,
              options: alias,
            },
            properties: [
              {
                id: FieldConfigProperty.Color,
                value: {
                  mode: FieldColorModeId.Fixed,
                  fixedColor: color,
                },
              },
            ],
          });
        }
      }
    }

    panel.fieldConfig = {
      overrides,
      defaults: {
        unit: angular.format,
        decimals: angular.decimals ? angular.decimals : 0, // Old piechart defaults to 0 decimals while the new one defaults to 1
      },
    };

    options.legend = {
      placement: 'right',
      values: [],
      displayMode: LegendDisplayMode.Table,
      showLegend: true,
      calcs: [],
    };

    if (angular.valueName) {
      options.reduceOptions = { calcs: [] };
      switch (angular.valueName) {
        case 'current':
          options.reduceOptions.calcs = ['lastNotNull'];
          break;
        case 'min':
          options.reduceOptions.calcs = ['min'];
          break;
        case 'max':
          options.reduceOptions.calcs = ['max'];
          break;
        case 'avg':
          options.reduceOptions.calcs = ['mean'];
          break;
        case 'total':
          options.reduceOptions.calcs = ['sum'];
          break;
      }
    }

    switch (angular.legendType) {
      case 'Under graph':
        options.legend.placement = 'bottom';
        break;
      case 'Right side':
        options.legend.placement = 'right';
        break;
    }

    switch (angular.pieType) {
      case 'pie':
        options.pieType = PieChartType.Pie;
        break;
      case 'donut':
        options.pieType = PieChartType.Donut;
        break;
    }

    if (angular.legend) {
      if (!angular.legend.show) {
        options.legend.showLegend = false;
      }
      if (angular.legend.values) {
        options.legend.values.push(PieChartLegendValues.Value);
      }
      if (angular.legend.percentage) {
        options.legend.values.push(PieChartLegendValues.Percent);
      }
    }

    // Set up labels when the old piechart is using 'on graph', for the legend option.
    if (angular.legendType === 'On graph') {
      options.legend.showLegend = false;
      options.displayLabels = [PieChartLabels.Name];
      if (angular.legend.values) {
        options.displayLabels.push(PieChartLabels.Value);
      }
      if (angular.legend.percentage) {
        options.displayLabels.push(PieChartLabels.Percent);
      }
    }

    return options;
  }
  return {};
};
