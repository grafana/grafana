import { PieChartType, SingleStatBaseOptions, PieChartLabelOptions, VizLegendOptions } from '@grafana/ui';
import { PieChartLabels } from '@grafana/ui/src/components/PieChart/PieChart';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  labelOptions: PieChartLabelOptions;
  displayLabels: PieChartLabels[];
  legend: VizLegendOptions;
}
