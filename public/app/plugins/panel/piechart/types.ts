import { PieChartType, SingleStatBaseOptions, PieChartLabelOptions } from '@grafana/ui';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  labelOptions: PieChartLabelOptions;
}
