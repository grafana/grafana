import { Field, fieldReducers } from '@grafana/data';
import { PanelModel } from '@grafana/ui';
import { GaugeOptions } from './types';
import { sharedSingleStatMigrationCheck } from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';

export const gaugePanelMigrationCheck = (panel: PanelModel<GaugeOptions>): Partial<GaugeOptions> => {
  if (!panel.options) {
    // This happens on the first load or when migrating from angular
    return {};
  }

  if (!panel.pluginVersion || panel.pluginVersion.startsWith('6.1')) {
    const old = panel.options as any;
    const { valueOptions } = old;

    const options = {} as GaugeOptions;
    options.showThresholdLabels = old.showThresholdLabels;
    options.showThresholdMarkers = old.showThresholdMarkers;
    options.orientation = old.orientation;

    const fieldOptions = (options.fieldOptions = {} as FieldDisplayOptions);
    fieldOptions.mappings = old.valueMappings;
    fieldOptions.thresholds = old.thresholds;

    const field = (fieldOptions.defaults = {} as Field);
    if (valueOptions) {
      field.unit = valueOptions.unit;
      field.decimals = valueOptions.decimals;

      // Make sure the stats have a valid name
      if (valueOptions.stat) {
        const reducer = fieldReducers.get(valueOptions.stat);
        if (reducer) {
          fieldOptions.calcs = [reducer.id];
        }
      }
    }
    field.min = old.minValue;
    field.max = old.maxValue;

    return options;
  }

  // Default to the standard migration path
  return sharedSingleStatMigrationCheck(panel);
};
