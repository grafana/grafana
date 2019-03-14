import { SingleStatOptions } from '@grafana/ui';

export interface GaugeOptions extends SingleStatOptions {
  maxValue: number;
  minValue: number;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
}

export const defaults: GaugeOptions = {
  minValue: 0,
  maxValue: 100,
  showThresholdMarkers: true,
  showThresholdLabels: false,

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
