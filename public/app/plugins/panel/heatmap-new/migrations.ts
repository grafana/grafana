import { FieldConfigSource, PanelModel, PanelTypeChangedHandler } from '@grafana/data';
import { AxisPlacement, ScaleDistribution, VisibilityMode } from '@grafana/schema';
import {
  HeatmapBucketLayout,
  HeatmapCalculationMode,
  HeatmapCalculationOptions,
} from 'app/features/transformers/calculateHeatmap/models.gen';

import { PanelOptions, defaultPanelOptions, HeatmapColorMode } from './models.gen';
import { colorSchemes } from './palettes';

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

  const calculate = angular.dataFormat === 'tsbuckets' ? false : true;
  const calculation: HeatmapCalculationOptions = {
    ...defaultPanelOptions.calculation,
  };

  const oldYAxis = { logBase: 1, ...angular.yAxis };

  if (calculate) {
    if (angular.xBucketSize) {
      calculation.xBuckets = { mode: HeatmapCalculationMode.Size, value: `${angular.xBucketSize}` };
    } else if (angular.xBucketNumber) {
      calculation.xBuckets = { mode: HeatmapCalculationMode.Count, value: `${angular.xBucketNumber}` };
    }

    if (angular.yBucketSize) {
      calculation.yBuckets = { mode: HeatmapCalculationMode.Size, value: `${angular.yBucketSize}` };
    } else if (angular.xBucketNumber) {
      calculation.yBuckets = { mode: HeatmapCalculationMode.Count, value: `${angular.yBucketNumber}` };
    }

    if (oldYAxis.logBase > 1) {
      calculation.yBuckets = {
        mode: HeatmapCalculationMode.Count,
        value: +oldYAxis.splitFactor > 0 ? `${oldYAxis.splitFactor}` : undefined,
        scale: {
          type: ScaleDistribution.Log,
          log: oldYAxis.logBase,
        },
      };
    }
  }

  const options: PanelOptions = {
    calculate,
    calculation,
    color: {
      ...defaultPanelOptions.color,
      steps: 128, // best match with existing colors
    },
    cellGap: asNumber(angular.cards?.cardPadding),
    cellSize: asNumber(angular.cards?.cardRound),
    yAxis: {
      axisPlacement: oldYAxis.show === false ? AxisPlacement.Hidden : AxisPlacement.Left,
      reverse: Boolean(angular.reverseYBuckets),
      axisWidth: oldYAxis.width ? +oldYAxis.width : undefined,
    },
    bucket: {
      layout: getHeatmapBucketLayout(angular.yBucketBound),
    },
    legend: {
      show: Boolean(angular.legend.show),
    },
    showValue: VisibilityMode.Never,
    tooltip: {
      show: Boolean(angular.tooltip?.show),
      yHistogram: Boolean(angular.tooltip?.showHistogram),
    },
    exemplars: {
      ...defaultPanelOptions.exemplars,
    },
  };

  if (angular.hideZeroBuckets) {
    options.filterValues = { ...defaultPanelOptions.filterValues }; // min: 1e-9
  }

  // Migrate color options
  const color = angular.color;
  switch (color?.mode) {
    case 'spectrum': {
      options.color.mode = HeatmapColorMode.Scheme;

      const current = color.colorScheme as string;
      let scheme = colorSchemes.find((v) => v.name === current);
      if (!scheme) {
        scheme = colorSchemes.find((v) => current.indexOf(v.name) >= 0);
      }
      options.color.scheme = scheme ? scheme.name : defaultPanelOptions.color.scheme;
      break;
    }
    case 'opacity': {
      options.color.mode = HeatmapColorMode.Opacity;
      options.color.scale = color.scale;
      break;
    }
  }
  options.color.min = color.min;
  options.color.max = color.max;

  return { fieldConfig, options };
}

function getHeatmapBucketLayout(v?: string): HeatmapBucketLayout {
  switch (v) {
    case 'upper':
      return HeatmapBucketLayout.ge;
    case 'lower':
      return HeatmapBucketLayout.le;
    case 'middle':
      return HeatmapBucketLayout.unknown;
  }
  return HeatmapBucketLayout.auto;
}

function asNumber(v: any): number | undefined {
  const num = +v;
  return isNaN(num) ? undefined : num;
}

export const heatmapMigrationHandler = (panel: PanelModel): Partial<PanelOptions> => {
  // Migrating from angular
  if (!panel.pluginVersion && Object.keys(panel.options).length === 0) {
    return heatmapChangedHandler(panel, 'heatmap', { angular: panel }, panel.fieldConfig);
  }
  return panel.options;
};
