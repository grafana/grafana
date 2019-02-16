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

export const defaults: GaugeOptions = {
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
  thresholds: [],
};
