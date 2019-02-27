import { PiechartType } from '@grafana/ui';

export interface PiechartOptions {
  pieType: PiechartType;
  strokeWidth: number;

  valueOptions: PiechartValueOptions;
  // TODO: Options for Legend / Combine components
}

export interface PiechartValueOptions {
  unit: string;
  stat: string;
}

export const defaults: PiechartOptions = {
  pieType: PiechartType.PIE,
  strokeWidth: 1,
  valueOptions: {
    unit: 'short',
    stat: 'current',
  },
};
