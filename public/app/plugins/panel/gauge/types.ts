import { Threshold, ValueMapping } from '@grafana/ui';

export interface GaugeOptions {
  decimals: number;
  valueMappings: ValueMapping[];
  maxValue: number;
  minValue: number;
  prefix: string;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
  stat: string;
  suffix: string;
  thresholds: Threshold[];
  unit: string;
}

export const PanelDefaults: GaugeOptions = {
  minValue: 0,
  maxValue: 100,
  prefix: '',
  showThresholdMarkers: true,
  showThresholdLabels: false,
  suffix: '',
  decimals: 0,
  stat: 'avg',
  unit: 'none',
  valueMappings: [],
  thresholds: [{ index: 1, value: 80, color: 'red' }, { index: 0, value: -Infinity, color: 'green' }],
};
