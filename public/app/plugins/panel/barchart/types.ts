import { VizOrientation } from '@grafana/data';
import {
  AxisConfig,
  BarValueVisibility,
  GraphGradientMode,
  HideableFieldConfig,
  OptionsWithLegend,
  OptionsWithTooltip,
  StackingMode,
} from '@grafana/ui';

/**
 * @alpha
 */
export interface BarChartOptions extends OptionsWithLegend, OptionsWithTooltip {
  orientation: VizOrientation;
  stacking: StackingMode;
  showValue: BarValueVisibility;
  barWidth: number;
  groupWidth: number;
}

/**
 * @alpha
 */
export interface BarChartFieldConfig extends AxisConfig, HideableFieldConfig {
  lineWidth?: number; // 0
  fillOpacity?: number; // 100
  gradientMode?: GraphGradientMode;
}

/**
 * @alpha
 */
export const defaultBarChartFieldConfig: BarChartFieldConfig = {
  lineWidth: 1,
  fillOpacity: 80,
  gradientMode: GraphGradientMode.None,
  axisSoftMin: 0,
};
