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
import { DataFrame, Field, VizOrientation } from '@grafana/data';

/**
 * @alpha
 */
export interface BarChartOptions extends OptionsWithLegend, OptionsWithTooltip, OptionsWithTextFormatting {
  xField?: string;
  orientation: VizOrientation;
  stacking: StackingMode;
  showValue: VisibilityMode;
  barWidth: number;
  barRadius?: number;
  groupWidth: number;
  xTickLabelRotation: number;
  xTickLabelMaxLength: number;
  colorByField?: string;

  // negative values indicate backwards skipping behavior
  xTickLabelSpacing?: number;
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

export interface BarChartDisplayValues {
  /** When the data can not display, this will be returned */
  warn?: string;

  /** All fields joined */
  aligned: DataFrame;

  /** The fields we can display, first field is X axis */
  viz: DataFrame;

  /** all viz fields without legend */
  legend: DataFrame;

  /** Potentialy color by a field value */
  colorByField?: Field;
}
