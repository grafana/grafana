import { PieChartType, SingleStatBaseOptions, PieChartLabels, VizLegendOptions } from '@grafana/ui';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  displayLabels: PieChartLabels[];
  legend: VizLegendOptions;
}
