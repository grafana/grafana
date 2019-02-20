import { Threshold, SelectOptionItem, ValueMapping } from '@grafana/ui';
import { SingleStatValueOptions } from '../gauge/types';

export interface BarGaugeOptions {
  minValue: number;
  maxValue: number;
  orientation: string;
  valueOptions: SingleStatValueOptions;
  valueMappings: ValueMapping[];
  thresholds: Threshold[];
}

export enum OrientationModes {
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}

export const orientationOptions: SelectOptionItem[] = [
  { value: OrientationModes.Horizontal, label: 'Horizontal' },
  { value: OrientationModes.Vertical, label: 'Vertical' },
];

export const defaults: BarGaugeOptions = {
  minValue: 0,
  maxValue: 100,
  orientation: OrientationModes.Horizontal,
  valueOptions: {
    unit: 'none',
    stat: 'avg',
    prefix: '',
    suffix: '',
    decimals: null,
  },
  thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
  valueMappings: [],
};
