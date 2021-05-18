import { VizLegendOptions, HideableFieldConfig, BarValueVisibility } from '@grafana/ui';

/**
 * @alpha
 */
export interface TimelineOptions {
  mode: TimelineMode; // not in the saved model!

  legend: VizLegendOptions;
  showValue: BarValueVisibility;
  rowHeight: number;
  colWidth?: number;
  alignValue: TimelineValueAlignment;
  mergeValues?: boolean;
}

export type TimelineValueAlignment = 'center' | 'left' | 'right';

/**
 * @alpha
 */
export interface TimelineFieldConfig extends HideableFieldConfig {
  lineWidth?: number; // 0
  fillOpacity?: number; // 100
}

/**
 * @alpha
 */
export const defaultPanelOptions: Partial<TimelineOptions> = {
  showValue: BarValueVisibility.Always,
  mergeValues: true,
  alignValue: 'left',
  rowHeight: 0.9,
};

/**
 * @alpha
 */
export const defaultTimelineFieldConfig: TimelineFieldConfig = {
  lineWidth: 1,
  fillOpacity: 70,
};

/**
 * @alpha
 */
export enum TimelineMode {
  Changes = 'changes',
  Samples = 'samples',
}
