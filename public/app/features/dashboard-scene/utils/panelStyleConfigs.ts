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
    customProps: readonly string[];
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
    customProps: [
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
 * Style config for the stat panel. No custom field config — all styling
 * comes from standard fieldConfig properties and panel-level options.
 *
 * fieldConfig.defaults:
 *   color – color scheme
 *
 * options:
 *   orientation          – panel orientation (auto, horizontal, vertical)
 *   textMode             – what text to display (auto, value, value_and_name, name, none)
 *   colorMode            – value, background, background_solid, none
 *   graphMode            – area, none
 *   justifyMode          – alignment of the text (auto, center)
 *   showPercentChange    – show percent change below value
 *   percentChangeColorMode – standard, inverted, same_as_value
 *   wideLayout           – use wide layout when panel is wide enough
 *   text                 – text sizes: { titleSize, valueSize }
 */
const statPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    customProps: [],
  },
  options: {
    props: [
      'orientation',
      'textMode',
      'colorMode',
      'graphMode',
      'justifyMode',
      'showPercentChange',
      'percentChangeColorMode',
      'wideLayout',
      'text',
    ],
  },
};

/**
 * Style config for the gauge panel. No custom field config — styling
 * comes from standard fieldConfig properties and panel-level options.
 *
 * fieldConfig.defaults:
 *   color – color scheme
 *
 * options:
 *   orientation         – panel orientation
 *   text                – text sizes: { titleSize, valueSize }
 *   shape               – circle vs gauge arc style
 *   barShape            – flat vs rounded bar ends
 *   barWidthFactor      – width of the gauge bar relative to available space
 *   effects             – visual effects: { barGlow, centerGlow, gradient }
 *   endpointMarker      – point, glow, or none at bar tip
 *   minVizWidth         – minimum width for manual sizing
 *   minVizHeight        – minimum height for manual sizing
 *   sizing              – auto vs manual gauge size
 *   segmentCount        – number of arc segments
 *   segmentSpacing      – spacing between segments
 *   showThresholdMarkers – tick marks at threshold boundaries
 *   showThresholdLabels  – labels at threshold and neutral values
 *   sparkline           – show sparkline in background
 *   textMode            – text displayed inside the gauge
 *   neutral             – neutral value dividing positive/negative coloring
 */
const gaugePanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    customProps: [],
  },
  options: {
    props: [
      'orientation',
      'text',
      'shape',
      'barShape',
      'barWidthFactor',
      'effects',
      'endpointMarker',
      'minVizWidth',
      'minVizHeight',
      'sizing',
      'segmentCount',
      'segmentSpacing',
      'showThresholdMarkers',
      'showThresholdLabels',
      'sparkline',
      'textMode',
      'neutral',
    ],
  },
};

/**
 * Style config for the bar gauge panel. No custom field config — styling
 * comes from standard fieldConfig properties and panel-level options.
 *
 * fieldConfig.defaults:
 *   color – color scheme
 *
 * options:
 *   orientation  – panel orientation (auto, horizontal, vertical)
 *   text         – text sizes: { titleSize, valueSize }
 *   legend       – legend options
 *   displayMode  – gradient, retro LCD, or basic fill
 *   valueMode    – value color, text color, or hidden
 *   namePlacement – auto, top, left, or hidden
 *   showUnfilled – render the unfilled region as gray
 *   sizing       – auto vs manual bar size
 *   minVizWidth  – minimum bar width for manual sizing
 *   minVizHeight – minimum bar height for manual sizing
 *   maxVizHeight – maximum bar height for manual sizing
 */
const barGaugePanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    customProps: [],
  },
  options: {
    props: [
      'orientation',
      'text',
      'legend',
      'displayMode',
      'valueMode',
      'namePlacement',
      'showUnfilled',
      'sizing',
      'minVizWidth',
      'minVizHeight',
      'maxVizHeight',
    ],
  },
};

/**
 * Style config for the bar chart panel.
 *
 * fieldConfig.defaults:
 *   color – color scheme
 *
 * fieldConfig.defaults.custom:
 *   lineWidth        – bar border width
 *   fillOpacity      – bar fill opacity
 *   gradientMode     – gradient fill mode
 *   thresholdsStyle  – threshold overlay style (lines/dashed/area)
 *   transform        – constant or negative-Y transform
 *   axisPlacement    – axis placement (auto, left, right, hidden)
 *   axisLabel        – axis label
 *   axisWidth        – axis width
 *   axisSoftMin      – soft minimum for axis scale
 *   axisSoftMax      – soft maximum for axis scale
 *   axisGridShow     – show axis grid lines
 *   axisBorderShow   – show axis border
 *   axisCenteredZero – center axis at zero
 *   axisColorMode    – axis color mode
 *   scaleDistribution – axis scale (linear, log, symlog)
 *
 * options:
 *   orientation         – vertical or horizontal bars
 *   xTickLabelRotation  – x-axis tick label rotation
 *   xTickLabelMaxLength – x-axis tick label truncation length
 *   xTickLabelSpacing   – x-axis tick label minimum spacing
 *   showValue           – show value labels on bars (auto, always, never)
 *   stacking            – stacking mode (none, normal, percent)
 *   groupWidth          – width of bar groups
 *   barWidth            – width of individual bars
 *   barRadius           – corner radius of bars
 *   fullHighlight       – highlight full bar area on hover
 *   legend              – legend options
 *   text                – text size options
 */
const barChartPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    customProps: [
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
      'legend',
      'text',
    ],
  },
};

/**
 * Style config for the pie chart panel.
 *
 * fieldConfig.defaults:
 *   color – color scheme (thresholds is disabled for this panel type)
 *
 * options:
 *   pieType       – pie or donut
 *   sort          – slice sort order (descending, ascending, none)
 *   displayLabels – labels shown on slices (percent, name, value)
 *   legend        – legend options including legend.values (percent, value)
 */
const pieChartPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    customProps: [],
  },
  options: {
    props: ['pieType', 'sort', 'displayLabels', 'legend'],
  },
};

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
 *   legend – legend options
 */
const histogramPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    customProps: ['lineWidth', 'fillOpacity', 'gradientMode', ...axisCustomDefaults],
  },
  options: {
    props: ['legend'],
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
 *   legend       – legend show/hide
 *   yAxis        – y-axis config (placement, scale, min/max, reverse, decimals)
 *   exemplars    – exemplar marker color
 *   selectionMode – which axis allows brush selection
 */
const heatmapPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: [],
    customProps: ['scaleDistribution'],
  },
  options: {
    props: ['color', 'cellGap', 'cellRadius', 'showValue', 'legend', 'yAxis', 'exemplars', 'selectionMode'],
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
 */
const stateTimelinePanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    customProps: ['lineWidth', 'fillOpacity', ...axisCustomDefaults],
  },
  options: {
    props: ['alignValue', 'mergeValues', 'rowHeight', 'showValue', 'legend'],
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
 */
const statusHistoryPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    customProps: ['lineWidth', 'fillOpacity', ...axisCustomDefaults],
  },
  options: {
    props: ['colWidth', 'rowHeight', 'showValue', 'legend'],
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
 *   legend – legend options
 *
 * Note: `mapping` and `series` are excluded — they reference specific field
 * names and are data configuration, not visual style.
 */
const xychartPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color'],
    customProps: [
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
    props: ['legend'],
  },
};

const PANEL_STYLE_CONFIGS: Record<string, PanelStyleConfig> = {
  timeseries: graphPanelStyleConfig,
  trend: graphPanelStyleConfig,
  candlestick: graphPanelStyleConfig,
  stat: statPanelStyleConfig,
  gauge: gaugePanelStyleConfig,
  bargauge: barGaugePanelStyleConfig,
  barchart: barChartPanelStyleConfig,
  piechart: pieChartPanelStyleConfig,
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
