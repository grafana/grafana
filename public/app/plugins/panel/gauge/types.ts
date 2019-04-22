import { VizOrientation, StatID, SingleStatBaseOptions } from '@grafana/ui';

export interface GaugeOptions extends SingleStatBaseOptions {
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
}

export const defaults: GaugeOptions = {
  showThresholdMarkers: true,
  showThresholdLabels: false,
  valueOptions: {
    title: '', // auto title
    showAllValues: false,
    stats: [StatID.mean],
    defaults: {},
    override: {
      min: 0,
      max: 100,
    },
  },
  valueMappings: [],
  thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
  orientation: VizOrientation.Auto,
};
