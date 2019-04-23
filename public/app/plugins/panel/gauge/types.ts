import { VizOrientation, StatID, SingleStatBaseOptions } from '@grafana/ui';

export interface GaugeOptions extends SingleStatBaseOptions {
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
  valueOptions: {
    prefix: '',
    suffix: '',
    decimals: null,
    stat: StatID.mean,
    unit: 'none',
  },
  valueMappings: [],
  thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
  orientation: VizOrientation.Auto,
};
