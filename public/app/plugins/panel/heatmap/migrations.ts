import { FieldConfigSource, PanelModel, PanelTypeChangedHandler } from '@grafana/data';
import { AxisPlacement, ScaleDistribution, VisibilityMode } from '@grafana/schema';
import {
  HeatmapCellLayout,
  HeatmapCalculationMode,
  HeatmapCalculationOptions,
} from 'app/features/transformers/calculateHeatmap/models.gen';

import { PanelOptions, defaultPanelOptions, HeatmapColorMode } from './models.gen';
import { colorSchemes } from './palettes';

/** Called when the version number changes */
export const heatmapMigrationHandler = (panel: PanelModel): Partial<PanelOptions> => {
  // Migrating from angular
  if (Object.keys(panel.options).length === 0) {
    return heatmapChangedHandler(panel, 'heatmap', { angular: panel }, panel.fieldConfig);
  }
  return panel.options;
};

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
  // alpha for 8.5+, then beta at 9.0.1
  if (prevPluginId === 'heatmap-new') {
    const { bucketFrame, ...options } = panel.options;
    if (bucketFrame) {
      return { ...options, rowsFrame: bucketFrame };
    }
    return panel.options;
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

  const cellGap = asNumber(angular.cards?.cardPadding, 2);
  const options: PanelOptions = {
    calculate,
    calculation,
    color: {
      ...defaultPanelOptions.color,
      steps: 128, // best match with existing colors
    },
    cellGap: cellGap ? cellGap : 1, // default to size 1
    cellRadius: asNumber(angular.cards?.cardRound), // just to keep it
    yAxis: {
      axisPlacement: oldYAxis.show === false ? AxisPlacement.Hidden : AxisPlacement.Left,
      reverse: Boolean(angular.reverseYBuckets),
      axisWidth: asNumber(oldYAxis.width),
      min: oldYAxis.min,
      max: oldYAxis.max,
      unit: oldYAxis.format,
      decimals: oldYAxis.decimals,
    },
    cellValues: {
      decimals: asNumber(angular.tooltipDecimals),
    },
    rowsFrame: {
      layout: getHeatmapCellLayout(angular.yBucketBound),
    },
    legend: {
      show: Boolean(angular.legend?.show),
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
  const color = angular.color ?? {};
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
  options.color.fill = color.cardColor;
  options.color.min = color.min;
  options.color.max = color.max;

  if (typeof color.min === 'number' && typeof color.max === 'number' && color.min > color.max) {
    options.color.min = color.max;
    options.color.max = color.min;
    options.color.reverse = true;
  }

  return { fieldConfig, options };
}

function getHeatmapCellLayout(v?: string): HeatmapCellLayout {
  switch (v) {
    case 'upper':
      return HeatmapCellLayout.ge;
    case 'lower':
      return HeatmapCellLayout.le;
    case 'middle':
      return HeatmapCellLayout.unknown;
  }
  return HeatmapCellLayout.auto;
}

function asNumber(v: any, defaultValue?: number): number | undefined {
  if (v == null || v === '') {
    return defaultValue;
  }
  const num = +v;
  return isNaN(num) ? defaultValue : num;
}
