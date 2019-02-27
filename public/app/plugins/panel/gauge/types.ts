import { Threshold, ValueMapping } from '@grafana/ui';

export interface GaugeOptions {
  valueMappings: ValueMapping[];
  maxValue: number;
  minValue: number;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
  thresholds: Threshold[];
  valueOptions: SingleStatValueOptions;
}

export interface SingleStatValueOptions {
  unit: string;
  suffix: string;
  stat: string;
  prefix: string;
  decimals?: number | null;
}

export const defaults: GaugeOptions = {
  minValue: 0,
  maxValue: 100,
  showThresholdMarkers: true,
  showThresholdLabels: false,
  valueOptions: {
    prefix: '',
    suffix: '',
    decimals: null,
    stat: 'avg',
    unit: 'none',
  },
  valueMappings: [],
  thresholds: [],
};
