import { VizOrientation, FieldDisplayOptions, SelectableValue } from '@grafana/data';
import { SingleStatBaseOptions } from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';
import { standardFieldDisplayOptions } from '../stat/types';

export interface GaugeOptions extends SingleStatBaseOptions {
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
}

export const standardGaugeFieldOptions: FieldDisplayOptions = {
  ...standardFieldDisplayOptions,
};

export const orientationOptions: Array<SelectableValue<VizOrientation>> = [
  { value: VizOrientation.Auto, label: 'Auto' },
  { value: VizOrientation.Horizontal, label: 'Horizontal' },
  { value: VizOrientation.Vertical, label: 'Vertical' },
];

export const defaults: GaugeOptions = {
  showThresholdMarkers: true,
  showThresholdLabels: false,
  fieldOptions: standardGaugeFieldOptions,
  orientation: VizOrientation.Auto,
};
