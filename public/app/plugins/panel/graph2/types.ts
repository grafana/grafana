import { LegendOptions } from '@grafana/ui';

export interface SeriesOptions {
  color: string;
  useRightYAxis?: boolean;
}
export interface GraphOptions {
  showBars: boolean;
  showLines: boolean;
  showPoints: boolean;
}

export interface Options {
  graph: GraphOptions;
  legend: LegendOptions;
  series: {
    [alias: string]: SeriesOptions;
  };
}

export const defaults: Options = {
  graph: {
    showBars: false,
    showLines: true,
    showPoints: false,
  },
  legend: {
    asTable: false,
    isVisible: true,
    placement: 'under',
  },
  series: {},
};
