import { VizOrientation, StatID } from '@grafana/ui';
import { SingleStatBaseOptions } from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';

export interface GaugeOptions extends SingleStatBaseOptions {
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
}

export const defaults: GaugeOptions = {
  showThresholdMarkers: true,
  showThresholdLabels: false,
  fieldOptions: {
    title: '', // auto title
    values: false,
    stats: [StatID.mean],
    defaults: {},
    override: {
      min: 0,
      max: 100,
    },
    mappings: [],
    thresholds: [{ index: 0, value: -Infinity, color: 'green' }, { index: 1, value: 80, color: 'red' }],
  },
  orientation: VizOrientation.Auto,
};
