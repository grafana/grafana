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
 * Style config for the bar gauge panel. No custom field config type.
 *
 * fieldConfig:
 *   color      – color scheme
 *   thresholds – threshold config driving bar colors
 *   mappings   – value-to-display mappings
 *
 * options:
 *   displayMode  – gradient, retro LCD, or basic fill
 *   valueMode    – value color, text color, or hidden
 *   namePlacement – auto, top, left, or hidden
 *   showUnfilled – render the unfilled region as gray
 *   orientation  – panel orientation (auto, horizontal, vertical)
 *   sizing       – auto vs manual bar size
 *   minVizWidth  – minimum bar width for manual sizing
 *   minVizHeight – minimum bar height for manual sizing
 *   maxVizHeight – maximum bar height for manual sizing
 *   text         – text sizes: { titleSize, valueSize }
 *   legend       – legend visibility and placement
 */
const barGaugePanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color', 'thresholds', 'mappings'],
    defaults: [],
  },
  options: {
    props: [
      'displayMode',
      'valueMode',
      'namePlacement',
      'showUnfilled',
      'orientation',
      'sizing',
      'minVizWidth',
      'minVizHeight',
      'maxVizHeight',
      'text',
      'legend',
    ],
  },
};

const PANEL_STYLE_CONFIGS: Record<string, PanelStyleConfig> = {
  timeseries: graphPanelStyleConfig,
  trend: graphPanelStyleConfig,
  candlestick: graphPanelStyleConfig,
  bargauge: barGaugePanelStyleConfig,
};

/**
 * Returns the PanelStyleConfig for the given plugin ID, or undefined if the
 * panel type does not support style copy/paste.
 */
export function getPanelStyleConfig(pluginId: string): PanelStyleConfig | undefined {
  return PANEL_STYLE_CONFIGS[pluginId];
}
