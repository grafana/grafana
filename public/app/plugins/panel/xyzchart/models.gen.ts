import { HideableFieldConfig, AxisConfig } from '@grafana/schema';

export interface ScatterSeriesConfig extends HideableFieldConfig, AxisConfig {
  x?: string;
  y?: string;
  z?: string;
}

export interface XYZDimensionConfig {
  frame: number;
  x?: string; // name | first
}

export interface ScatterPlotOptions {
  pointColor: string;
  pointSize: number;
  themeColor?: string;
  hudBgColor?: string;

  seriesMapping: 'auto' | 'manual' | undefined;
  dims?: XYZDimensionConfig;
  series?: ScatterSeriesConfig;
}

export const defaultScatterConfig: ScatterPlotOptions = {
  pointColor: 'red',
  pointSize: 5,
  seriesMapping: 'auto',
};
