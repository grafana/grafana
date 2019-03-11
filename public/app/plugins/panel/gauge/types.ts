import { Threshold, ValueMapping } from '@grafana/ui';
import { DisplayValueOptions } from '@grafana/ui/src/utils/valueProcessor';

export interface GaugeOptions {
  maxValue: number;
  minValue: number;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;

  stat: string;
  displayOptions: DisplayValueOptions;

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
  displayOptions: {
    prefix: '',
    suffix: '',
    decimals: null,
    unit: 'none',
    mappings: [],
    thresholds: [],
  },
};
