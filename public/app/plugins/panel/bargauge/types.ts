import { VizOrientation, SelectOptionItem, StatID, SingleStatBaseOptions } from '@grafana/ui';

export interface BarGaugeOptions extends SingleStatBaseOptions {
  minValue: number;
  maxValue: number;
  displayMode: 'basic' | 'lcd' | 'gradient';
}

export const displayModes: SelectOptionItem[] = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'lcd', label: 'Retro LCD' },
  { value: 'basic', label: 'Basic' },
];

export const orientationOptions: SelectOptionItem[] = [
  { value: VizOrientation.Horizontal, label: 'Horizontal' },
  { value: VizOrientation.Vertical, label: 'Vertical' },
];

export const defaults: BarGaugeOptions = {
  minValue: 0,
  maxValue: 100,
  displayMode: 'lcd',
  orientation: VizOrientation.Horizontal,
  valueOptions: {
    unit: 'none',
    stat: StatID.mean,
    prefix: '',
    suffix: '',
    decimals: null,
  },
  thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
  valueMappings: [],
};
