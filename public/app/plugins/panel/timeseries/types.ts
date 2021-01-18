import { VizLegendOptions, GraphTooltipOptions } from '@grafana/ui';

export interface GraphOptions {
  // Redraw as time passes
  realTimeUpdates?: boolean;
}

export interface Options {
  graph: GraphOptions;
  legend: VizLegendOptions;
  tooltipOptions: GraphTooltipOptions;
}
