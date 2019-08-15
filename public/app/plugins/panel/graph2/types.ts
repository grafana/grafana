import { LegendOptions } from '@grafana/ui';
import { YAxis } from '@grafana/data';

import { GraphLegendEditorLegendOptions } from './GraphLegendEditor';

export interface SeriesOptions {
  color?: string;
  yAxis?: YAxis;
  [key: string]: any;
}
export interface GraphOptions {
  showBars: boolean;
  showLines: boolean;
  showPoints: boolean;
}

export interface Options {
  graph: GraphOptions;
  legend: LegendOptions & GraphLegendEditorLegendOptions;
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
