import { PanelData } from '@grafana/data';
import {
  VizLegendOptions,
  VizTooltipOptions,
  GraphGradientMode,
  StackingConfig,
  AxisConfig,
  HideableFieldConfig,
} from '@grafana/schema';

export interface HistogramOptions {
  /**
   * Bucket count (approx)
   */
  bucketCount?: number;
  /**
   * Size of each bucket
   */
  bucketSize?: number;
  /**
   * Offset buckets by this amount
   */
  bucketOffset?: number;
  /**
   * Combines multiple series into a single histogram
   */
  combine?: boolean;
  /**
   * Legend configuration
   */
  legend: VizLegendOptions;
  /**
   * Tooltip configuration
   */
  tooltip: VizTooltipOptions;
}

export interface HistogramFieldConfig extends AxisConfig, HideableFieldConfig {
  /**
   * Controls line width of the bars.
   */
  lineWidth?: number;
  /**
   * Controls the fill opacity of the bars.
   */
  fillOpacity?: number;
  /**
   * Set the mode of the gradient fill.
   */
  gradientMode?: GraphGradientMode;
  /**
   * Stacking configuration
   */
  stacking?: StackingConfig;
}

export interface HistogramPanelProps {
  data: PanelData;
  options: HistogramOptions;
  fieldConfig: HistogramFieldConfig;
  width: number;
  height: number;
}

// Default values
export const defaultHistogramOptions: Partial<HistogramOptions> = {
  bucketCount: 30,
  bucketOffset: 0,
  combine: false,
};

export const defaultHistogramFieldConfig: Partial<HistogramFieldConfig> = {
  fillOpacity: 80,
  gradientMode: GraphGradientMode.None,
  lineWidth: 1,
};
