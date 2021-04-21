import { VizOrientation } from '@grafana/data';
import { AxisConfig, GraphGradientMode, HideableFieldConfig, StackingMode } from '../uPlot/config';
import { VizLegendOptions } from '../VizLegend/models.gen';

/**
 * @alpha
 */
export enum BarValueVisibility {
  Auto = 'auto',
  Never = 'never',
  Always = 'always',
}

/**
 * @alpha
 */
export interface BarChartOptions {
  orientation: VizOrientation;
  legend: VizLegendOptions;
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
