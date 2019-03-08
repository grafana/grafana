import { PieChartType } from '@grafana/ui';

export interface PieChartOptions {
  pieType: PieChartType;
  strokeWidth: number;

  valueOptions: PieChartValueOptions;
  // TODO: Options for Legend / Combine components
}

export interface PieChartValueOptions {
  unit: string;
  stat: string;
}

export const defaults: PieChartOptions = {
  pieType: PieChartType.PIE,
  strokeWidth: 1,
  valueOptions: {
    unit: 'short',
    stat: 'current',
  },
};
