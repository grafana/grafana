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
 * Shared axis custom field config keys used by several panel types.
 * Extracted to avoid repetition.
 */
const axisCustomDefaults: readonly string[] = [
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
];

/**
 * Style config for the histogram panel.
 *
 * fieldConfig.defaults:
 *   color – color scheme
 *
 * fieldConfig.defaults.custom:
 *   lineWidth    – bar border width
 *   fillOpacity  – bar fill opacity
 *   gradientMode – gradient fill mode
 *   + axis config
 *
 * options:
 *   legend  – legend options
 *   tooltip – tooltip options
 */
const histogramPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    defaults: ['lineWidth', 'fillOpacity', 'gradientMode', ...axisCustomDefaults],
  },
  options: {
    props: ['legend', 'tooltip'],
  },
};

/**
 * Style config for the heatmap panel. Most standard fieldConfig options are
 * disabled; all visual configuration lives in panel options.
 *
 * fieldConfig.defaults.custom:
 *   scaleDistribution – y-axis scale distribution
 *
 * options:
 *   color        – color mode, scheme, scale, opacity, steps, min/max
 *   cellGap      – gap between cells
 *   cellRadius   – corner radius of cells
 *   showValue    – show value inside cells (auto, always, never)
 *   tooltip      – tooltip options
 *   legend       – legend show/hide
 *   yAxis        – y-axis config (placement, scale, min/max, reverse, decimals)
 *   exemplars    – exemplar marker color
 *   selectionMode – which axis allows brush selection
 */
const heatmapPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: [],
    defaults: ['scaleDistribution'],
  },
  options: {
    props: ['color', 'cellGap', 'cellRadius', 'showValue', 'tooltip', 'legend', 'yAxis', 'exemplars', 'selectionMode'],
  },
};

/**
 * Style config for the state timeline panel.
 *
 * fieldConfig.defaults:
 *   color – color scheme
 *
 * fieldConfig.defaults.custom:
 *   lineWidth   – border width of state regions
 *   fillOpacity – fill opacity of state regions
 *   + axis config
 *
 * options:
 *   alignValue  – value alignment inside regions (left, center, right)
 *   mergeValues – merge consecutive equal values into one region
 *   rowHeight   – height of each row (0–1)
 *   showValue   – show value labels (auto, always, never)
 *   legend      – legend options
 *   tooltip     – tooltip options
 */
const stateTimelinePanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    defaults: ['lineWidth', 'fillOpacity', ...axisCustomDefaults],
  },
  options: {
    props: ['alignValue', 'mergeValues', 'rowHeight', 'showValue', 'legend', 'tooltip'],
  },
};

/**
 * Style config for the status history panel.
 *
 * fieldConfig.defaults:
 *   color – color scheme
 *
 * fieldConfig.defaults.custom:
 *   lineWidth   – border width of status cells
 *   fillOpacity – fill opacity of status cells
 *   + axis config
 *
 * options:
 *   colWidth  – column width (0–1)
 *   rowHeight – row height (0–1)
 *   showValue – show value labels (auto, always, never)
 *   legend    – legend options
 *   tooltip   – tooltip options
 */
const statusHistoryPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    defaults: ['lineWidth', 'fillOpacity', ...axisCustomDefaults],
  },
  options: {
    props: ['colWidth', 'rowHeight', 'showValue', 'legend', 'tooltip'],
  },
};

/**
 * Style config for the XY chart panel.
 *
 * fieldConfig.defaults:
 *   color – color scheme
 *
 * fieldConfig.defaults.custom:
 *   fillOpacity      – marker fill opacity
 *   lineStyle        – line dash style
 *   lineWidth        – line width
 *   pointShape       – circle or square
 *   pointSize        – marker size (fixed, min, max)
 *   pointStrokeWidth – marker stroke width
 *   show             – points, lines, or points+lines
 *   + axis config
 *
 * options:
 *   legend  – legend options
 *   tooltip – tooltip options
 *
 * Note: `mapping` and `series` are excluded — they reference specific field
 * names and are data configuration, not visual style.
 */
const xychartPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    defaults: [
      'fillOpacity',
      'lineStyle',
      'lineWidth',
      'pointShape',
      'pointSize',
      'pointStrokeWidth',
      'show',
      ...axisCustomDefaults,
    ],
  },
  options: {
    props: ['legend', 'tooltip'],
  },
};

const PANEL_STYLE_CONFIGS: Record<string, PanelStyleConfig> = {
  timeseries: graphPanelStyleConfig,
  trend: graphPanelStyleConfig,
  candlestick: graphPanelStyleConfig,
  histogram: histogramPanelStyleConfig,
  heatmap: heatmapPanelStyleConfig,
  'state-timeline': stateTimelinePanelStyleConfig,
  'status-history': statusHistoryPanelStyleConfig,
  xychart: xychartPanelStyleConfig,
};

/**
 * Returns the PanelStyleConfig for the given plugin ID, or undefined if the
 * panel type does not support style copy/paste.
 */
export function getPanelStyleConfig(pluginId: string): PanelStyleConfig | undefined {
  return PANEL_STYLE_CONFIGS[pluginId];
}
