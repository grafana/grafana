import { FieldConfigSource, PanelModel, PanelTypeChangedHandler } from '@grafana/data';
import {
  AxisPlacement,
  ScaleDistribution,
  VisibilityMode,
  HeatmapCellLayout,
  HeatmapCalculationMode,
  HeatmapCalculationOptions,
} from '@grafana/schema';
import { TooltipDisplayMode } from '@grafana/ui';

import { colorSchemes } from './palettes';
import { Options, defaultOptions, HeatmapColorMode } from './types';

/** Called when the version number changes */
export const heatmapMigrationHandler = (panel: PanelModel): Partial<Options> => {
  // Migrating from angular
  if (Object.keys(panel.options ?? {}).length === 0) {
    return heatmapChangedHandler(panel, 'heatmap', { angular: panel }, panel.fieldConfig);
  }

  // multi tooltip mode in 10.3+
  let showTooltip = panel.options?.tooltip?.show;
  if (showTooltip !== undefined) {
    if (showTooltip === true) {
      panel.options.tooltip.mode = TooltipDisplayMode.Single;
    } else if (showTooltip === false) {
      panel.options.tooltip.mode = TooltipDisplayMode.None;
    }

    // Remove old tooltip option
    delete panel.options.tooltip?.show;
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

export function angularToReactHeatmap(angular: any): { fieldConfig: FieldConfigSource; options: Options } {
  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  const calculate = angular.dataFormat === 'tsbuckets' ? false : true;
  const calculation: HeatmapCalculationOptions = {
    ...defaultOptions.calculation,
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
  const options: Options = {
    calculate,
    calculation,
    color: {
      ...defaultOptions.color,
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
      mode: Boolean(angular.tooltip?.show) ? TooltipDisplayMode.Single : TooltipDisplayMode.None,
      yHistogram: Boolean(angular.tooltip?.showHistogram),
    },
    exemplars: {
      ...defaultOptions.exemplars,
    },
  };

  if (angular.hideZeroBuckets) {
    options.filterValues = { ...defaultOptions.filterValues }; // min: 1e-9
  }

  // Migrate color options
  const color = angular.color ?? {};
  switch (color?.mode) {
    case 'spectrum': {
      options.color.mode = HeatmapColorMode.Scheme;

      const current: string = color.colorScheme;
      let scheme = colorSchemes.find((v) => v.name === current);
      if (!scheme) {
        scheme = colorSchemes.find((v) => current.indexOf(v.name) >= 0);
      }
      options.color.scheme = scheme ? scheme.name : defaultOptions.color.scheme;
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

function asNumber(v: unknown, defaultValue?: number): number | undefined {
  if (v == null || v === '') {
    return defaultValue;
  }
  const num = +v;
  return isNaN(num) ? defaultValue : num;
}
