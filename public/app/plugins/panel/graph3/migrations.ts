import { FieldConfig, NullValueMode, PanelModel } from '@grafana/data';
import { GraphFieldConfig, LegendDisplayMode } from '@grafana/ui';
import { GraphMode, LineInterpolation } from '@grafana/ui/src/components/uPlot/config';
import { Options } from './types';

/**
 * This is called when the panel changes from another panel
 */
export const graphPanelChangedHandler = (
  panel: PanelModel<Partial<Options>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  // Changing from float table panel
  if (prevPluginId === 'graph' && prevOptions.angular) {
    const after = flotToGraphOptions(prevOptions.angular);
    console.log('Change from graph', { prevOptions, after });
    panel.fieldConfig = after.fieldConfig;
    return after.options;
  }

  return {};
};

export function flotToGraphOptions(angular: any) {
  const config: GraphFieldConfig = {
    mode: angular.lines ? GraphMode.Line : GraphMode.Points,
  };
  if (angular.bars) {
    config.mode = GraphMode.Bars;
  }
  config.lineWidth = angular.lineWidth;
  config.pointSize = angular.pointradius;

  if (angular.steppedLine) {
    config.lineInterpolation = LineInterpolation.Staircase;
  }

  const options: Options = {
    graph: {},
    legend: {
      displayMode: LegendDisplayMode.List,
      placement: 'bottom',
    },
    tooltipOptions: {
      mode: 'single',
    },
  };

  const defaults: FieldConfig = {
    decimals: angular.decimals,
    nullValueMode: angular.nullPointMode as NullValueMode,
    custom: config,
  };

  return {
    fieldConfig: {
      defaults,
      overrides: [],
    },
    options,
  };
}
