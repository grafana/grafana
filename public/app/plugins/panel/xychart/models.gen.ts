import {
  OptionsWithTooltip,
  OptionsWithLegend,
  LineStyle,
  VisibilityMode,
  HideableFieldConfig,
  AxisConfig,
  AxisPlacement,
  ColorDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from '@grafana/schema';
import {
  DimensionSupplier,
} from 'app/features/dimensions';

import { DEFAULT_POINT_SIZE } from './config';

// export enum ScatterLineMode {
//   None = 'none',
//   Linear = 'linear',
//   Smooth
//   r2, etc
// }

export enum ScatterShow {
  Points = 'points',
  Lines = 'lines',
  PointsAndLines = 'points+lines',
}

export enum SeriesMapping {
  Auto = 'auto',
  Manual = 'manual',
}

export interface ScatterFieldConfig extends HideableFieldConfig, AxisConfig {
  show?: ScatterShow;

  lineWidth?: number;
  lineStyle?: LineStyle;
  lineColor?: ColorDimensionConfig;

  pointSize?: ScaleDimensionConfig; // only 'fixed' is exposed in the UI
  pointColor?: ColorDimensionConfig;
  pointSymbol?: DimensionSupplier<string>;

  label?: VisibilityMode;
  labelValue?: TextDimensionConfig;
}

/** Configured in the panel level */
export interface ScatterSeriesConfig extends ScatterFieldConfig {
  x?: string;
  y?: string;
  name?: string;
}

export const defaultScatterConfig: ScatterFieldConfig = {
  show: ScatterShow.Points,
  lineWidth: 1,
  lineStyle: {
    fill: 'solid',
  },
  pointSize: {
    fixed: DEFAULT_POINT_SIZE,
    min: 1,
    max: 20,
  },
  axisPlacement: AxisPlacement.Auto,
};

/** Old config saved with 8.0+ */
export interface XYDimensionConfig {
  frame: number;
  x?: string; // name | first
  exclude?: string[]; // all other numbers except
}

export interface XYChartOptions extends OptionsWithLegend, OptionsWithTooltip {
  seriesMapping?: SeriesMapping;
  dims: XYDimensionConfig;

  series?: ScatterSeriesConfig[];
}
