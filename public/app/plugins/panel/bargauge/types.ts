import { SingleStatBaseOptions } from '@grafana/ui';
import { standardGaugeFieldOptions } from '../gauge/types';
import { VizOrientation, SelectableValue } from '@grafana/data';

export interface BarGaugeOptions extends SingleStatBaseOptions {
  displayMode: 'basic' | 'lcd' | 'gradient';
  showUnfilled: boolean;
}

export const displayModes: Array<SelectableValue<string>> = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'lcd', label: 'Retro LCD' },
  { value: 'basic', label: 'Basic' },
];

export const defaults: BarGaugeOptions = {
  displayMode: 'lcd',
  orientation: VizOrientation.Horizontal,
  fieldOptions: standardGaugeFieldOptions,
  showUnfilled: true,
};
