import { VizLegendOptions, VizTooltipOptions } from '@grafana/ui';

export interface OptionsWithLegend {
  legend: VizLegendOptions;
}
export interface OptionsWithTooltip {
  tooltip: VizTooltipOptions;
}

export interface TimeSeriesOptions extends OptionsWithLegend, OptionsWithTooltip {}
