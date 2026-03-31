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
 * Style config for the stat panel. All style comes from top-level FieldConfig
 * properties and panel-level options — the stat panel has no custom field config type.
 *
 * fieldConfig:
 *   color      – color scheme driving value/background coloring
 *   thresholds – threshold config that determines color bands
 *   mappings   – value-to-display mappings (text, color, icon)
 *
 * options:
 *   colorMode            – how color is applied (value, background gradient/solid, none)
 *   graphMode            – sparkline display (none, area)
 *   justifyMode          – text alignment (auto, center)
 *   textMode             – what text to show (auto, value, value and name, name, none)
 *   wideLayout           – wide layout toggle for value-and-name mode
 *   showPercentChange    – show percent change below the value
 *   percentChangeColorMode – coloring of the percent change indicator
 *   text                 – text sizes: { titleSize, valueSize, percentChangeSize }
 *   orientation          – panel orientation (auto, horizontal, vertical)
 */
const statPanelStyleConfig: PanelStyleConfig = {
  fieldConfig: {
    defaultsProps: ['color', 'thresholds', 'mappings'],
    defaults: [],
  },
  options: {
    props: [
      'colorMode',
      'graphMode',
      'justifyMode',
      'textMode',
      'wideLayout',
      'showPercentChange',
      'percentChangeColorMode',
      'text',
      'orientation',
    ],
  },
};

const PANEL_STYLE_CONFIGS: Record<string, PanelStyleConfig> = {
  timeseries: graphPanelStyleConfig,
  trend: graphPanelStyleConfig,
  candlestick: graphPanelStyleConfig,
  stat: statPanelStyleConfig,
};

/**
 * Returns the PanelStyleConfig for the given plugin ID, or undefined if the
 * panel type does not support style copy/paste.
 */
export function getPanelStyleConfig(pluginId: string): PanelStyleConfig | undefined {
  return PANEL_STYLE_CONFIGS[pluginId];
}
