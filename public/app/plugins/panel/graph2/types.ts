import { LegendOptions } from '@grafana/ui';
import { GraphTooltipOptions } from '@grafana/ui/src/visualizations';
import { YAxis } from '@grafana/data';

import { GraphLegendEditorLegendOptions } from './GraphLegendEditor';
// TODO move out from single stat
import { standardFieldDisplayOptions } from '../stat/types';
import { FieldDisplayOptions } from '@grafana/data/src/field';

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
