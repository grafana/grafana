import { FieldConfigSource, PanelModel, PanelTypeChangedHandler } from '@grafana/data';
import { LegendDisplayMode, VisibilityMode } from '@grafana/schema';
import {
  HeatmapCalculationMode,
  HeatmapCalculationOptions,
} from 'app/features/transformers/calculateHeatmap/models.gen';

import { HeatmapSourceMode, PanelOptions, defaultPanelOptions } from './models.gen';

/**
 * This is called when the panel changes from another panel
 */
export const heatmapChangedHandler: PanelTypeChangedHandler = (panel, prevPluginId, prevOptions, prevFieldConfig) => {
  if (prevPluginId === 'heatmap' && prevOptions.angular) {
    const { fieldConfig, options } = angularToReactHeatmap({
      ...prevOptions.angular,
      fieldConfig: prevFieldConfig,
    });
    panel.fieldConfig = fieldConfig; // Mutates the incoming panel
    return options;
  }
  return {};
};

export function angularToReactHeatmap(angular: any): { fieldConfig: FieldConfigSource; options: PanelOptions } {
  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  const source = angular.dataFormat === 'tsbuckets' ? HeatmapSourceMode.Data : HeatmapSourceMode.Calculate;
  const heatmap: HeatmapCalculationOptions = {
    ...defaultPanelOptions.heatmap,
  };

  if (source === HeatmapSourceMode.Calculate) {
    if (angular.xBucketSize) {
      heatmap.xAxis = { mode: HeatmapCalculationMode.Size, value: `${angular.xBucketSize}` };
    } else if (angular.xBucketNumber) {
      heatmap.xAxis = { mode: HeatmapCalculationMode.Count, value: `${angular.xBucketNumber}` };
    }

    if (angular.yBucketSize) {
      heatmap.yAxis = { mode: HeatmapCalculationMode.Size, value: `${angular.yBucketSize}` };
    } else if (angular.xBucketNumber) {
      heatmap.yAxis = { mode: HeatmapCalculationMode.Count, value: `${angular.yBucketNumber}` };
    }
  }

  const options: PanelOptions = {
    source,
    heatmap,
    color: {
      ...defaultPanelOptions.color,
      steps: 256, // best match with existing colors
    },
    cellGap: asNumber(angular.cards?.cardPadding),
    cellSize: asNumber(angular.cards?.cardRound),
    yAxisLabels: angular.yBucketBound,
    yAxisReverse: angular.reverseYBuckets,
    legend: {
      displayMode: angular.legend.show ? LegendDisplayMode.List : LegendDisplayMode.Hidden,
      calcs: [],
      placement: 'bottom',
    },
    showValue: VisibilityMode.Never,
    tooltip: {
      show: Boolean(angular.tooltip?.show),
      yHistogram: Boolean(angular.tooltip?.showHistogram),
    },
  };

  return { fieldConfig, options };
}

function asNumber(v: any): number | undefined {
  const num = +v;
  return isNaN(num) ? undefined : num;
}

export const heatmapMigrationHandler = (panel: PanelModel): Partial<PanelOptions> => {
  // Nothing yet
  return panel.options;
};
