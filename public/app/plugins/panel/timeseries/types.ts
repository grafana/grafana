import { VizLegendOptions, GraphTooltipOptions } from '@grafana/ui';

export interface OptionsWithLegend {
  legend: VizLegendOptions;
}

export interface Options extends OptionsWithLegend {
  tooltipOptions: GraphTooltipOptions;
}
