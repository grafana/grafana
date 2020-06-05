import { DisplayValue } from './displayValue';
import { Field } from './dataFrame';
import { FlotSeries } from './flot';

export interface YAxis {
  index: number;
  min?: number;
  tickDecimals?: number;
}

export type GraphSeriesValue = number | null;

/** View model projection of a series */
export interface GraphSeriesXY {
  color?: string;
  highlightColor?: string;
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

  showBars?: boolean;
  showLines?: boolean;
  showPoints?: boolean;
}

export function graphSeriesToFlotSeries(graphSeries: GraphSeriesXY): FlotSeries {
  return {
    data: graphSeries.data as Array<[number, number]>,
    color: graphSeries.color,
    highlightColor: graphSeries.highlightColor,
    label: graphSeries.label,
    lines: {
      show: graphSeries.showLines,
    },
    bars: {
      show: graphSeries.showBars,
    },
    points: {
      show: graphSeries.showPoints,
    },
    stack: graphSeries.showBars,

    yaxis: graphSeries.yAxis.index,
  };
}

export interface CreatePlotOverlay {
  (element: JQuery, event: any, plot: { getOptions: () => { events: { manager: any } } }): any;
}
