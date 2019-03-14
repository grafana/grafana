import { SelectOptionItem, VizOrientation } from '@grafana/ui';

import { GaugeOptions, defaults as gaugeDefaults } from '../gauge/types';

export interface BarGaugeOptions extends GaugeOptions {
  orientation: VizOrientation;
}

export const orientationOptions: SelectOptionItem[] = [
  { value: VizOrientation.Horizontal, label: 'Horizontal' },
  { value: VizOrientation.Vertical, label: 'Vertical' },
];

export const defaults: BarGaugeOptions = {
  ...gaugeDefaults,
  orientation: VizOrientation.Horizontal,
};
