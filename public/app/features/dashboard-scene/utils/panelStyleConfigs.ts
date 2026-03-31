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
 * Style config for the gauge panel. No custom field config type — all style comes
 * from top-level FieldConfig properties and panel-level options.
 *
 * fieldConfig:
 *   color      – color scheme
 *   thresholds – threshold config that drives gauge color bands
 *   mappings   – value-to-display mappings
 *
 * options:
 *   shape               – circle vs arc style
 *   orientation         – panel orientation (auto, horizontal, vertical)
 *   sizing              – auto vs manual gauge size
 *   minVizWidth         – minimum width for manual sizing
 *   minVizHeight        – minimum height for manual sizing
 *   barWidthFactor      – width of the gauge bar relative to available space
 *   segmentCount        – number of arc segments
 *   segmentSpacing      – spacing between segments
 *   barShape            – flat vs rounded bar ends
 *   endpointMarker      – point, glow, or none at the bar tip
 *   textMode            – text displayed inside the gauge
 *   showThresholdMarkers – tick marks at threshold boundaries
 *   showThresholdLabels  – labels at threshold and neutral values
 *   effects             – visual effects: barGlow, centerGlow, gradient
 *   sparkline           – show sparkline in background
 *   neutral             – neutral value dividing positive/negative coloring
 *   text                – text sizes: { titleSize, valueSize }
 */
const gaugePanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color', 'thresholds', 'mappings'],
    defaults: [],
  },
  options: {
    props: [
      'shape',
      'orientation',
      'sizing',
      'minVizWidth',
      'minVizHeight',
      'barWidthFactor',
      'segmentCount',
      'segmentSpacing',
      'barShape',
      'endpointMarker',
      'textMode',
      'showThresholdMarkers',
      'showThresholdLabels',
      'effects',
      'sparkline',
      'neutral',
      'text',
    ],
  },
};

const PANEL_STYLE_CONFIGS: Record<string, PanelStyleConfig> = {
  timeseries: graphPanelStyleConfig,
  trend: graphPanelStyleConfig,
  candlestick: graphPanelStyleConfig,
  gauge: gaugePanelStyleConfig,
};

/**
 * Returns the PanelStyleConfig for the given plugin ID, or undefined if the
 * panel type does not support style copy/paste.
 */
export function getPanelStyleConfig(pluginId: string): PanelStyleConfig | undefined {
  return PANEL_STYLE_CONFIGS[pluginId];
}
