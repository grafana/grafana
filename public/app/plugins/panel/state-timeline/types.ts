import { VizLegendOptions, HideableFieldConfig, BarValueVisibility } from '@grafana/ui';

/**
 * @alpha
 */
export interface TimelineOptions {
  legend: VizLegendOptions;
  showValue: BarValueVisibility;
  rowHeight: number;
  colWidth?: number;
  mergeValues?: boolean;
}

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
  mergeValues: true,
  rowHeight: 0.9,
};

/**
 * @alpha
 */
export const defaultTimelineFieldConfig: TimelineFieldConfig = {
  lineWidth: 1,
  fillOpacity: 70,
};
