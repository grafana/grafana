import { VizLegendOptions, GraphGradientMode, HideableFieldConfig, BarValueVisibility } from '@grafana/ui';

/**
 * @alpha
 */
export interface TimelineOptions {
  mode: TimelineMode;
  legend: VizLegendOptions;
  showValue: BarValueVisibility;
  rowHeight: number;
  colWidth?: number;
}

/**
 * @alpha
 */
export interface TimelineFieldConfig extends HideableFieldConfig {
  lineWidth?: number; // 0
  fillOpacity?: number; // 100
  gradientMode?: GraphGradientMode;
}

/**
 * @alpha
 */
export const defaultTimelineFieldConfig: TimelineFieldConfig = {
  lineWidth: 1,
  fillOpacity: 80,
  gradientMode: GraphGradientMode.None,
};

/**
 * @alpha
 */
export enum TimelineMode {
  Spans = 'spans',
  Grid = 'grid',
}
