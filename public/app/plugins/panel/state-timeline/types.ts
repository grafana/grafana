import { DashboardCursorSync } from '@grafana/data';
import {
  HideableFieldConfig,
  OptionsWithLegend,
  OptionsWithTimezones,
  OptionsWithTooltip,
  VisibilityMode,
} from '@grafana/schema';

/**
 * @alpha
 */
export interface TimelineOptions extends OptionsWithLegend, OptionsWithTooltip, OptionsWithTimezones {
  mode: TimelineMode; // not in the saved model!

  showValue: VisibilityMode;
  rowHeight: number;

  // only used for "samples" mode (status-history)
  colWidth?: number;
  // only used in "changes" mode (state-timeline)
  mergeValues?: boolean;
  // only used in "changes" mode (state-timeline)
  alignValue?: TimelineValueAlignment;

  sync?: () => DashboardCursorSync;
  getValueColor?: (frameIdx: number, fieldIdx: number, value: any) => string;
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
  showValue: VisibilityMode.Auto,
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
  // status-history
  Samples = 'samples',
}
