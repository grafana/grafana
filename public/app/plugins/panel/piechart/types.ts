import { PieChartType, ReducerID, VizOrientation, SingleStatBaseOptions } from '@grafana/ui';

export interface PieChartOptions extends SingleStatBaseOptions {
  pieType: PieChartType;
  strokeWidth: number;
}

export const defaults: PieChartOptions = {
  pieType: PieChartType.PIE,
  strokeWidth: 1,
  valueOptions: {
    unit: 'short',
    stat: ReducerID.last,
    suffix: '',
    prefix: '',
  },
  valueMappings: [],
  thresholds: [],
  orientation: VizOrientation.Auto,
};
