import { PieChartType, SingleStatBaseOptions, PieChartLabelOptions, VizLegendOptions } from '@grafana/ui';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  labelOptions: PieChartLabelOptions;
  displayLabels: [];
  legend: VizLegendOptions;
}
