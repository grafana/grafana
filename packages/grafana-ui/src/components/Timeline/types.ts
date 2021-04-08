import { GraphNGProps } from '../GraphNG/GraphNG';
import { GraphGradientMode, HideableFieldConfig } from '../uPlot/config';
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

/**
 * @alpha
 */
export interface TimelineProps extends GraphNGProps {
  mode: TimelineMode;
  rowHeight: number;
  showValue: BarValueVisibility;
  colWidth?: number;
}
