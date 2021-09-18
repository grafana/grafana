import { OptionsWithTooltip, OptionsWithLegend, LineStyle, VisibilityMode, HideableFieldConfig } from '@grafana/schema';
import { ColorDimensionConfig, TextDimensionConfig, ScaleDimensionConfig } from 'app/features/dimensions';
import { DimensionValues, FrameFieldMap } from '@grafana/ui';

/** Old config saved with 8.0+ */
export interface XYDimensionConfig {
  frame: number;
  x?: string; // name | first
  exclude?: string[]; // all other numbers except
}

export enum ScatterLineMode {
  None = 'none',
  Linear = 'linear',
  // Smooth
  // r2, etc
}

export interface ScatterFieldConfig extends HideableFieldConfig {
  line?: ScatterLineMode;
  lineWidth?: number;
  lineStyle?: LineStyle;
  lineColor?: ColorDimensionConfig;

  point?: VisibilityMode;
  pointSize?: ScaleDimensionConfig;
  pointColor?: ColorDimensionConfig;
  // pointSymbol?: DimensionSupplier<string>;

  label?: VisibilityMode;
  labelValue?: TextDimensionConfig;
}

export const defaultScatterConfig: ScatterFieldConfig = {
  line: ScatterLineMode.None, // no line
  point: VisibilityMode.Auto, //
};

// Runtime processed type send to render
export interface ScatterSeries extends ScatterFieldConfig {
  frameIndex: number;
  xField: number;
  yField: number;
}

export interface XYChartOptions extends OptionsWithLegend, OptionsWithTooltip {
  dims: XYDimensionConfig; // <<< OLD!!

  // Flag to trigger new behavior
  mode?: 'auto' | 'explicit';

  series?: ScatterSeries[];
}

export interface ScatterFrameFieldMap extends FrameFieldMap {
  line: ScatterLineMode[];
  lineWidth: number[];
  lineStyle: LineStyle[];
  lineColor: Array<CanvasRenderingContext2D['strokeStyle']>;

  point: VisibilityMode[];
  pointSize: Array<DimensionValues<number>>;
  pointColor: Array<DimensionValues<string>>;

  label: VisibilityMode[];
  labelValue: Array<DimensionValues<string>>;
}

/*
// ohlc field map
export interface FrameFieldMapOHLC {
  x: // time
  o: // open
  h: // high
  l: // low
  c: // close
  v: // volume
  color?: number; // synthetic? based on direction of close - open (intra-period), or close - close (inter-period)
  // field indices of interest in specific contexts
  tooltip?: number[];
  legend?: number[];
}
*/

/*
// box & whisker field map
export interface FrameFieldMapBox {
  label?: number;
  med:
  avg:
  min:
  max:
  q2:
  q3:
  color?: // synthetic
  // field indices of interest in specific contexts
  tooltip?: number[];
  legend?: number[];
}
*/
