import { VizOrientation } from '@grafana/data';
import { AxisConfig, GraphGradientMode, HideableFieldConfig } from '../uPlot/config';
import { VizLegendOptions } from '../VizLegend/types';

/**
 * @alpha
 */
export enum BarStackingMode {
  None = 'none',
  Standard = 'standard',
  Percent = 'percent',
}

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
  stacking: BarStackingMode;
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
