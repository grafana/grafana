import { LegendOptions, GraphTooltipOptions } from '@grafana/ui';
import { YAxis, FieldDisplayOptions } from '@grafana/data';

import { GraphLegendEditorLegendOptions } from './GraphLegendEditor';
// TODO move out from single stat
import { standardFieldDisplayOptions } from '../stat/types';

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
  fieldOptions: FieldDisplayOptions;
  tooltipOptions: GraphTooltipOptions;
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
  fieldOptions: { ...standardFieldDisplayOptions },
  tooltipOptions: { mode: 'single' },
};
