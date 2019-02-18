import { Threshold, ValueMapping } from '@grafana/ui';
import { SingleStatValueOptions } from '../gauge/types';

export interface BarGaugeOptions {
  minValue: number;
  maxValue: number;
  valueOptions: SingleStatValueOptions;
  valueMappings: ValueMapping[];
  thresholds: Threshold[];
}

export const defaults: BarGaugeOptions = {
  minValue: 0,
  maxValue: 100,
  valueOptions: {
    prefix: '',
    suffix: '',
    decimals: null,
    stat: 'avg',
    unit: 'none',
  },
  thresholds: [
    { index: 2, value: 80, color: 'red' },
    { index: 1, value: 50, color: 'orange' },
    { index: 0, value: -Infinity, color: 'green' },
  ],
  valueMappings: [],
};
