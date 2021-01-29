import { VizLegendOptions, GraphTooltipOptions } from '@grafana/ui';

export interface GraphOptions {
  stack: boolean;
  stackPercent: boolean;
}

export interface OptionsWithLegend {
  legend: VizLegendOptions;
}

export interface Options extends OptionsWithLegend {
  graph: GraphOptions;
  tooltipOptions: GraphTooltipOptions;
}
