import { SelectOptionItem, VizOrientation } from '@grafana/ui';

import { SingleStatOptions } from '@grafana/ui';

export interface BarGaugeOptions extends SingleStatOptions {
  maxValue: number;
  minValue: number;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
  orientation: VizOrientation;
}

export const orientationOptions: SelectOptionItem[] = [
  { value: VizOrientation.Horizontal, label: 'Horizontal' },
  { value: VizOrientation.Vertical, label: 'Vertical' },
];

export const defaults: BarGaugeOptions = {
  minValue: 0,
  maxValue: 100,
  showThresholdMarkers: true,
  showThresholdLabels: false,
  orientation: VizOrientation.Horizontal,

  stat: 'avg',
  display: {
    prefix: '',
    suffix: '',
    decimals: null,
    unit: 'none',
    mappings: [],
    thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
  },
};
