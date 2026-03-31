import type { FieldConfig } from '@grafana/data';

/**
 * Central registry mapping panel plugin IDs to their style configuration.
 * A PanelStyleConfig declares which fieldConfig keys count as "style" properties
 * for a given panel type, enabling copy/paste of visual styles across panels.
 */

export interface PanelStyleConfig {
  fieldConfig: {
    /** Top-level (non-custom) fieldConfig.defaults keys to include in style copy, e.g. 'color' */
    defaultsProps: ReadonlyArray<keyof FieldConfig>;
    /** Keys within fieldConfig.defaults.custom to include in style copy */
    defaults: readonly string[];
  };
  /** Top-level panel options keys to include in style copy */
  options?: {
    props: readonly string[];
  };
}

/**
 * Shared style config for panels that use GraphFieldConfig:
 * timeseries, trend, and candlestick all share the same field config shape.
 */
const graphPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    defaults: [
      // Line config
      'lineColor',
      'lineInterpolation',
      'lineStyle',
      'lineWidth',
      'spanNulls',
      // Fill config
      'fillBelowTo',
      'fillColor',
      'fillOpacity',
      // Points config
      'pointColor',
      'pointSize',
      'pointSymbol',
      'showPoints',
      // Axis config
      'axisBorderShow',
      'axisCenteredZero',
      'axisColorMode',
      'axisGridShow',
      'axisLabel',
      'axisPlacement',
      'axisSoftMax',
      'axisSoftMin',
      'axisWidth',
      // Graph field config
      'drawStyle',
      'gradientMode',
      'insertNulls',
      'showValues',
      // Stacking
      'stacking',
      // Bar config
      'barAlignment',
      'barWidthFactor',
      'barMaxWidth',
    ],
  },
};

/**
 * Style config for the bar chart panel.
 *
 * fieldConfig.defaults:
 *   color      – color scheme
 *   thresholds – threshold config (used by thresholdsStyle overlay)
 *
 * fieldConfig.defaults.custom:
 *   lineWidth       – bar border width
 *   fillOpacity     – bar fill opacity
 *   gradientMode    – gradient fill mode
 *   thresholdsStyle – threshold overlay style (lines/dashed/area)
 *   transform       – constant or negative-Y transform
 *   axisPlacement   – axis placement (auto, left, right, hidden)
 *   axisLabel       – axis label
 *   axisWidth       – axis width
 *   axisSoftMin     – soft minimum for axis scale
 *   axisSoftMax     – soft maximum for axis scale
 *   axisGridShow    – show axis grid lines
 *   axisBorderShow  – show axis border
 *   axisCenteredZero – center axis at zero
 *   axisColorMode   – axis color mode
 *   scaleDistribution – axis scale (linear, log, symlog)
 *
 * options:
 *   orientation          – vertical or horizontal bars
 *   xTickLabelRotation   – x-axis tick label rotation
 *   xTickLabelMaxLength  – x-axis tick label truncation length
 *   xTickLabelSpacing    – x-axis tick label minimum spacing
 *   showValue            – show value labels on bars (auto, always, never)
 *   stacking             – stacking mode (none, normal, percent)
 *   groupWidth           – width of bar groups
 *   barWidth             – width of individual bars
 *   barRadius            – corner radius of bars
 *   fullHighlight        – highlight full bar area on hover
 *   tooltip              – tooltip options
 *   legend               – legend options
 *   text                 – text size options
 */
const barChartPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color', 'thresholds'],
    defaults: [
      'lineWidth',
      'fillOpacity',
      'gradientMode',
      'thresholdsStyle',
      'transform',
      'axisPlacement',
      'axisLabel',
      'axisWidth',
      'axisSoftMin',
      'axisSoftMax',
      'axisGridShow',
      'axisBorderShow',
      'axisCenteredZero',
      'axisColorMode',
      'scaleDistribution',
    ],
  },
  options: {
    props: [
      'orientation',
      'xTickLabelRotation',
      'xTickLabelMaxLength',
      'xTickLabelSpacing',
      'showValue',
      'stacking',
      'groupWidth',
      'barWidth',
      'barRadius',
      'fullHighlight',
      'tooltip',
      'legend',
      'text',
    ],
  },
};

const PANEL_STYLE_CONFIGS: Record<string, PanelStyleConfig> = {
  timeseries: graphPanelStyleConfig,
  trend: graphPanelStyleConfig,
  candlestick: graphPanelStyleConfig,
  barchart: barChartPanelStyleConfig,
};

/**
 * Returns the PanelStyleConfig for the given plugin ID, or undefined if the
 * panel type does not support style copy/paste.
 */
export function getPanelStyleConfig(pluginId: string): PanelStyleConfig | undefined {
  return PANEL_STYLE_CONFIGS[pluginId];
}
