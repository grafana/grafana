import {
  OptionsWithLegend,
  OptionsWithTextFormatting,
  OptionsWithTooltip,
  AxisConfig,
  VisibilityMode,
  GraphGradientMode,
  HideableFieldConfig,
  StackingMode,
} from '@grafana/schema';
import { VizOrientation } from '@grafana/data';

/**
 * @alpha
 */
export interface BarChartOptions extends OptionsWithLegend, OptionsWithTooltip, OptionsWithTextFormatting {
  orientation: VizOrientation;
  stacking: StackingMode;
  showValue: VisibilityMode;
  barWidth: number;
  groupWidth: number;
  xTickLabelRotation: number;
  xTickLabelMaxLength: number;
  rawValue: (seriesIdx: number, valueIdx: number) => number;
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
