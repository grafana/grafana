import { VizOrientation, SelectableItem, SingleStatBaseOptions } from '@grafana/ui';
import { standardGaugeFieldOptions } from '../gauge/types';

export interface BarGaugeOptions extends SingleStatBaseOptions {
  displayMode: 'basic' | 'lcd' | 'gradient';
}

export const displayModes: Array<SelectableItem<string>> = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'lcd', label: 'Retro LCD' },
  { value: 'basic', label: 'Basic' },
];

export const orientationOptions: Array<SelectableItem<VizOrientation>> = [
  { value: VizOrientation.Horizontal, label: 'Horizontal' },
  { value: VizOrientation.Vertical, label: 'Vertical' },
];

export const defaults: BarGaugeOptions = {
  displayMode: 'lcd',
  orientation: VizOrientation.Horizontal,
  fieldOptions: standardGaugeFieldOptions,
};
