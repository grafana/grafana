import {
  PieChartType,
  SingleStatBaseOptions,
  PieChartLabels,
  PieChartLegendOptions,
  VizTooltipOptions,
} from '@grafana/ui';
export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  displayLabels: PieChartLabels[];
  legend: PieChartLegendOptions;
  tooltip: VizTooltipOptions;
}
