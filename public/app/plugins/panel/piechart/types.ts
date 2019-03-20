import { PieChartType } from '@grafana/ui';

export interface PieChartOptions {
  pieType: PieChartType;
  strokeWidth: number;
  valueOptions: PieChartValueOptions;
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
