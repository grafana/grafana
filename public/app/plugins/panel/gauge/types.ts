import { Threshold, ValueMapping, DisplayValueOptions } from '@grafana/ui';

export interface GaugeOptions {
  maxValue: number;
  minValue: number;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;

  stat: string;
  display: DisplayValueOptions;

  // TODO: migrate to DisplayValueOptions
  thresholds?: Threshold[];
  valueMappings?: ValueMapping[];
  valueOptions?: SingleStatValueOptions;
}

/** Deprecated -- migrate to  */
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

  stat: 'avg',
  display: {
    prefix: '',
    suffix: '',
    decimals: null,
    unit: 'none',
    mappings: [],
    thresholds: [],
  },
};
