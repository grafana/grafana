import { Field, fieldReducers } from '@grafana/data';
import { PanelModel, FieldDisplayOptions } from '@grafana/ui';
import { GaugeOptions } from './types';
import {
  sharedSingleStatMigrationCheck,
  migrateOldThresholds,
} from '@grafana/ui/src/components/SingleStatShared/SingleStatBaseOptions';

export const gaugePanelMigrationCheck = (panel: PanelModel<GaugeOptions>): Partial<GaugeOptions> => {
  if (!panel.options) {
    // This happens on the first load or when migrating from angular
    return {};
  }

  const previousVersion = panel.pluginVersion || '';
  if (!previousVersion || previousVersion.startsWith('6.1')) {
    const old = panel.options as any;
    const { valueOptions } = old;

    const options = {} as GaugeOptions;
    options.showThresholdLabels = old.showThresholdLabels;
    options.showThresholdMarkers = old.showThresholdMarkers;
    options.orientation = old.orientation;

    const fieldOptions = (options.fieldOptions = {} as FieldDisplayOptions);

    const field = (fieldOptions.defaults = {} as Field);
    field.mappings = old.valueMappings;
    field.thresholds = migrateOldThresholds(old.thresholds);
    field.unit = valueOptions.unit;
    field.decimals = valueOptions.decimals;

    // Make sure the stats have a valid name
    if (valueOptions.stat) {
      fieldOptions.calcs = [fieldReducers.get(valueOptions.stat).id];
    }
    field.min = old.minValue;
    field.max = old.maxValue;

    return options;
  } else if (previousVersion.startsWith('6.2') || previousVersion.startsWith('6.3')) {
    const old = panel.options as any;
    const { fieldOptions } = old;
    if (fieldOptions) {
      const { mappings, thresholds, ...rest } = fieldOptions;
      rest.default = {
        mappings,
        thresholds: migrateOldThresholds(thresholds),
        ...rest.defaults,
      };
      return {
        ...old.options,
        fieldOptions: rest,
      };
    }
  }

  // Default to the standard migration path
  return sharedSingleStatMigrationCheck(panel);
};
