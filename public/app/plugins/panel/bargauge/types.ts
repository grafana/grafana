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
    unit: 'none',
    stat: 'avg',
    prefix: '',
    suffix: '',
    decimals: null,
  },
  thresholds: [{ index: 1, value: 80, color: 'red' }, { index: 0, value: -Infinity, color: 'green' }],
  valueMappings: [],
};
