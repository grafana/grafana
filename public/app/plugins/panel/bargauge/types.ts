import { VizOrientation, SelectOptionItem } from '@grafana/ui';

import { SingleStatBaseOptions } from '../singlestat2/types';

export const orientationOptions: SelectOptionItem[] = [
  { value: VizOrientation.Horizontal, label: 'Horizontal' },
  { value: VizOrientation.Vertical, label: 'Vertical' },
];

export interface BarGaugeOptions extends SingleStatBaseOptions {
  minValue: number;
  maxValue: number;
}

export const defaults: BarGaugeOptions = {
  minValue: 0,
  maxValue: 100,
  orientation: VizOrientation.Horizontal,
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
