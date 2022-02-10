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

export interface PanelOptions extends OptionsWithLegend, OptionsWithTooltip, OptionsWithTextFormatting {
  xField?: string;
  colorByField?: string;
  orientation: VizOrientation;
  stacking: StackingMode;
  showValue: VisibilityMode;
  barWidth: number;
  barRadius?: number;
  groupWidth: number;
  xTickLabelRotation: number;
  xTickLabelMaxLength: number;
  xTickLabelSpacing?: number; // negative values indicate backwards skipping behavior
}

export const defaultPanelOptions: Partial<PanelOptions> = {
  stacking: StackingMode.None,
  orientation: VizOrientation.Auto,
  xTickLabelRotation: 0,
  xTickLabelSpacing: 0,
  showValue: VisibilityMode.Auto,
  groupWidth: 0.7,
  barWidth: 0.97,
  barRadius: 0,
};

export interface BarChartFieldConfig extends AxisConfig, HideableFieldConfig {
  lineWidth?: number; // 0
  fillOpacity?: number; // 100
  gradientMode?: GraphGradientMode;
}

export const defaultBarChartFieldConfig: BarChartFieldConfig = {
  lineWidth: 1,
  fillOpacity: 80,
  gradientMode: GraphGradientMode.None,
  axisSoftMin: 0,
};
