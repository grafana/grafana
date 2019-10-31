import { VizOrientation, FieldDisplayOptions } from '@grafana/data';
import { SingleStatBaseOptions } from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';
import { standardFieldDisplayOptions } from '../singlestat2/types';

export interface GaugeOptions extends SingleStatBaseOptions {
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
}

export const standardGaugeFieldOptions: FieldDisplayOptions = {
  ...standardFieldDisplayOptions,
};

export const defaults: GaugeOptions = {
  showThresholdMarkers: true,
  showThresholdLabels: false,
  fieldOptions: standardGaugeFieldOptions,
  orientation: VizOrientation.Auto,
};
