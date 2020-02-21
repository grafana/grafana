import { DisplayValue } from './displayValue';
import { Field } from './dataFrame';

export interface YAxis {
  index: number;
  min?: number;
  tickDecimals?: number;
}

export type GraphSeriesValue = number | null;

/** View model projection of a series */
export interface GraphSeriesXY {
  color: string;
  data: GraphSeriesValue[][]; // [x,y][]
  isVisible: boolean;
  label: string;
  yAxis: YAxis;
  // Field with series' time values
  timeField: Field;
  // Field with series' values
  valueField: Field;
  seriesIndex: number;
  timeStep: number;

  info?: DisplayValue[]; // Legend info
}

interface FlotFont {
  size: number; // in pixels
  lineHeight: number; // in pixels
  style: string;
  weight: string;
  family: string;
  variant: string;
  color: string;
}

interface FlotCrosshairOptions {
  mode?: null | 'x' | 'y' | 'xy';
  color?: string;
  lineWidth?: number;
}

interface FlotSelectionOptions {
  mode?: null | 'x' | 'y' | 'xy';
  color?: string;
  shape?: 'round' | 'miter' | 'bevel';
  minSize?: number;
}

export interface FlotPlotOptions {
  colors?: string[];
  legend?: FlotLegend;
  xaxis?: FlotAxis;
  yaxis?: FlotAxis;
  xaxes?: FlotAxis[];
  yaxes?: FlotAxis[];
  series?: Partial<FlotSeries>;
  grid?: GridOptions;
  interaction?: {
    redrawOverlayInterval?: number;
  };
  hooks?: FlotHooks;

  crosshair?: FlotCrosshairOptions;

  selection?: FlotSelectionOptions;
}

export interface FlotPlot {
  // public functions
  setData: (data: Array<Array<[number, number]> | FlotSeries>) => void;
  setupGrid: () => void;
  draw: () => void;
  getPlaceHolder: () => HTMLElement;
  getCanvas: () => HTMLCanvasElement;
  getPlotOffset: () => { left: number; right: number; top: number; bottom: number };
  width: () => number;
  height: () => number;
  offset: () => { left: number; top: number };
  getData: () => FlotSeries[];
  getAxes: () => {
    [key: string]: FlotAxis;
    xaxis: FlotAxis;
    yaxis: FlotAxis;
  };
  getXAxes: () => FlotAxis[];
  getYAxes: () => FlotAxis[];
  c2p: (pos: { left: number; top: number }) => { x: number; y: number };
  p2c: any;
  getOptions: () => FlotPlotOptions;
  highlight: any;
  unhighlight: any;
  triggerRedrawOverlay: any;
  pointOffset: any;
  shutdown: any;
  destroy: any;
  resize: any;

  // public attributes
  hooks: FlotHooks;
}

interface FlotDatapoints {
  points: number[];
  format?: {
    number: boolean;
    required: boolean;
    x?: boolean;
    y?: boolean;
    defaultValue?: number;
    autoscale?: boolean;
  };
  pointsize?: number;
}

interface FlotHooks {
  processOptions?: (plot: FlotPlot, options: FlotPlotOptions) => void;
  processRawData?: (
    plot: FlotPlot,
    series: FlotSeries,
    data: Array<[number, number]>,
    datapoints: FlotDatapoints
  ) => void;
  processDatapoints?: (plot: FlotPlot, series: FlotSeries, datapoints: Required<FlotDatapoints>) => void;
  processOffset?: (plot: FlotPlot, offset: { left: number; right: number; top: number; bottom: number }) => void;
  drawBackground?: (plot: FlotPlot, canvascontext: CanvasRenderingContext2D) => void;
  drawSeries?: (plot: FlotPlot, canvascontext: CanvasRenderingContext2D, series: FlotSeries) => void;
  draw?: (plot: FlotPlot, canvascontext: CanvasRenderingContext2D) => void;
  bindEvents?: (plot: FlotPlot, eventHolder: JQuery) => void;
  drawOverlay?: (plot: FlotPlot, canvascontext: CanvasRenderingContext2D) => void;
  shutdown?: (plot: FlotPlot, eventHolder: JQuery) => void;
}

interface FlotAxisCommon {
  show?: null | boolean;
  position?: 'bottom' | 'top' | 'left' | 'right';

  color?: null | string;
  tickColor?: null | string;
  font?: null | FlotFont;

  min?: null | number;
  max?: null | number;
  autoscaleMargin?: null | number;

  transform?: null | ((v: number) => number);
  inverseTransform?: null | ((v: number) => number);

  ticks?:
    | null
    | number
    | number[]
    | Array<[number, string]>
    | ((axis: { min: number; max: number }) => number[] | Array<[number, string]>);
  tickSize?: number | [number, string];
  minTickSize?: number | [number, string];
  tickFormatter?: ((val: number, b: Pick<FlotAxis, 'min' | 'max' | 'tickDecimals' | 'tickSize'>) => string) | string;
  tickDecimals?: null | number;

  labelWidth?: null | number;
  labelHeight?: null | number;
  reserveSpace?: null | true;

  tickLength?: null | number; // in pixels

  alignTicksWithAxis?: null | number;
}

interface FlotAxisDefaultMode extends FlotAxisCommon {
  mode?: null; // null means data are interpreted as decimal numbers
}

interface FlotAxisTS extends FlotAxisCommon {
  mode?: 'time';
  timezone?: null | 'browser' | string; // only makes sense for mode 'time'

  minTickSize?: [number, 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year'];
  timeformat?: null | string;
  monthNames?: null | [string, string, string, string, string, string, string, string, string, string, string, string];
  dayNames?: null | [string, string, string, string, string, string, string];
  twelveHourClock?: boolean;
}

export type FlotAxis = FlotAxisDefaultMode | FlotAxisTS;

interface FlotGradient {
  colors: Array<
    | {
        opacity?: number;
        brightness?: number;
      }
    | string
  >;
}
export interface FlotGridMarking {
  xaxis?: { from: number; to: number };
  yaxis?: { from: number; to: number };
  x2axis?: { from: number; to: number };
  y2axis?: { from: number; to: number };
  color?: string;
}

interface GridOptions {
  show?: boolean;
  aboveData?: boolean;
  color?: string;
  backgroundColor?: FlotGradient | string | null;
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
  labelMargin?: number;
  axisMargin?: number;
  markings?: FlotGridMarking[] | ((axes: Record<'xaxis' | 'yaxis', FlotAxis>) => FlotGridMarking[]);
  borderWidth?: number | { top?: number; right?: number; bottom?: number; left?: number };
  borderColor?: string | null | { top?: string; right?: string; bottom?: string; left?: string };
  minBorderMargin?: number | null;
  clickable?: boolean;
  hoverable?: boolean;
  autoHighlight?: boolean;
  mouseActiveRadius?: number;
}

interface DisplayOptions {
  show?: boolean;
  lineWidth?: number;
  fill?: boolean | number;
}

interface FlotLineOptions extends DisplayOptions {
  zero?: boolean;
  steps?: boolean;
  fillColor?: null | false | string;
}

interface FlotBarOptions extends DisplayOptions {
  zero?: boolean;
  barWidth?: number; // in units of x-axis
  align?: 'left' | 'right' | 'center';
  horizontal?: boolean;
  fillColor?: null | false | string | FlotGradient;
}

interface FlotPointOptions extends DisplayOptions {
  radius?: number;
  symbol?: 'circle' | ((ctx: any, x: number, y: number, radius: number, shadow: boolean) => void);
  fillColor?: null | false | string;
}

export interface FlotSeries {
  data: Array<[number, number]>;

  color?: string | number;
  label?: string;
  lines?: FlotLineOptions;
  bars?: FlotBarOptions;
  points?: FlotPointOptions;
  xaxis?: number; // ID of x-axis to plot series against
  yaxis?: number; // ID of y-axis to plot series against
  clickable?: boolean;
  hoverable?: boolean;
  shadowSize?: number;
  highlightColor?: string | number;

  // Stack options
  stack?: null | boolean | number | string;
}

interface FlotLegend {
  show?: boolean;
  labelFormatter?: (label: string, series: FlotSeries) => string;
  labelBoxBorderColor?: string;
  noColumns?: number;
  position?: 'ne' | 'nw' | 'se' | 'sw';
  margin?: number | [number, number];
  backgroundColor?: string;
  backgroundOpacity?: number; // [0,1]
  container?: Element;
  sorted?:
    | boolean
    | 'ascending'
    | 'descending'
    | 'reverse'
    | ((a: { label: string; color: string }, b: { label: string; color: string }) => number);
}

export interface CreatePlotOverlay {
  (element: JQuery, event: any, plot: { getOptions: () => { events: { manager: any } } }): any;
}
