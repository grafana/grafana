import { SingleStatBaseOptions, BarGaugeDisplayMode } from '@grafana/ui';
import { commonValueOptionDefaults } from '../stat/types';
import { VizOrientation, SelectableValue } from '@grafana/data';

export interface BarGaugeOptions extends SingleStatBaseOptions {
  displayMode: BarGaugeDisplayMode;
  showUnfilled: boolean;
}

export const displayModes: Array<SelectableValue<string>> = [
  { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
  { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
  { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
];

export const defaults: BarGaugeOptions = {
  displayMode: BarGaugeDisplayMode.Lcd,
  orientation: VizOrientation.Horizontal,
  reduceOptions: commonValueOptionDefaults,
  showUnfilled: true,
};
