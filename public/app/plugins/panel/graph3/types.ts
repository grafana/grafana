import { LegendOptions, GraphTooltipOptions } from '@grafana/ui';
import { YAxis } from '@grafana/data';

export type NullValuesMode = 'null' | 'connected' | 'asZero';

export interface SeriesOptions {
  color?: string;
  yAxis?: YAxis;
  [key: string]: any;
}

export interface GraphOptions {
  // Redraw as time passes
  realTimeUpdates?: boolean;
}

export interface Options {
  graph: GraphOptions;
  legend: LegendOptions & GraphLegendEditorLegendOptions;
  series: {
    [alias: string]: SeriesOptions;
  };
  tooltipOptions: GraphTooltipOptions;
  values: {
    nullValues: NullValuesMode;
  };
}

export const defaults: Options = {
  graph: {
    // showBars: false,
    // showLines: true,
    // showPoints: false,
  },
  legend: {
    asTable: false,
    isVisible: true,
    placement: 'under',
  },
  series: {},
  tooltipOptions: { mode: 'single' },
  values: {
    nullValues: 'null',
  },
};

export interface GraphLegendEditorLegendOptions extends LegendOptions {
  stats?: string[];
  decimals?: number;
  sortBy?: string;
  sortDesc?: boolean;
}
