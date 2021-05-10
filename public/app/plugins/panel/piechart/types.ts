import { SingleStatBaseOptions, VizLegendOptions, VizTooltipOptions } from '@grafana/ui';

/**
 * @beta
 */
export enum PieChartType {
  Pie = 'pie',
  Donut = 'donut',
}

/**
 * @beta
 */
export enum PieChartLegendValues {
  Value = 'value',
  Percent = 'percent',
}

/**
 * @beta
 */
export enum PieChartLabels {
  Name = 'name',
  Value = 'value',
  Percent = 'percent',
}

/**
 * @beta
 */
export interface PieChartLegendOptions extends VizLegendOptions {
  values: PieChartLegendValues[];
}

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  displayLabels: PieChartLabels[];
  legend: PieChartLegendOptions;
  tooltip: VizTooltipOptions;
}
