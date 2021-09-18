import { LineStyle, VisibilityMode } from '@grafana/schema';
import { DimensionValues, FrameFieldMap } from '@grafana/ui';
import { ScatterLineMode } from './models.gen';

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
