import { HideableFieldConfig, BarValueVisibility, OptionsWithLegend } from '@grafana/ui';

/**
 * @alpha
 */
export interface TimelineOptions extends OptionsWithLegend {
  mode: TimelineMode; // not in the saved model!

  showValue: BarValueVisibility;
  rowHeight: number;

  // only used for "samples" mode (status-grid)
  colWidth?: number;
  // only used in "changes" mode (state-timeline)
  mergeValues?: boolean;
  // only used in "changes" mode (state-timeline)
  alignValue?: TimelineValueAlignment;
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
  showValue: BarValueVisibility.Auto,
  alignValue: 'left',
  mergeValues: true,
  rowHeight: 0.9,
};

/**
 * @alpha
 */
export const defaultTimelineFieldConfig: TimelineFieldConfig = {
  lineWidth: 0,
  fillOpacity: 70,
};

/**
 * @alpha
 */
export enum TimelineMode {
  // state-timeline
  Changes = 'changes',
  // status-grid
  Samples = 'samples',
}
