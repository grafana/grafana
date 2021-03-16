import { PieChartType, SingleStatBaseOptions, PieChartLabels, PieChartLegendOptions } from '@grafana/ui';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  displayLabels: PieChartLabels[];
  legend: PieChartLegendOptions;
}
