import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';

import { VizOrientation, PanelModel } from '../../types/panel';
import { FieldDisplayOptions } from '../../utils/fieldDisplay';
import { Field } from '../../types';
import { getFieldReducers } from '../../utils/index';

export interface SingleStatBaseOptions {
  fieldOptions: FieldDisplayOptions;
  orientation: VizOrientation;
}

const optionsToKeep = ['fieldOptions', 'orientation'];

export const sharedSingleStatOptionsCheck = (
  options: Partial<SingleStatBaseOptions> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  for (const k of optionsToKeep) {
    if (prevOptions.hasOwnProperty(k)) {
      options[k] = cloneDeep(prevOptions[k]);
    }
  }
  return options;
};

export const sharedSingleStatMigrationCheck = (panel: PanelModel<SingleStatBaseOptions>) => {
  if (!panel.options) {
    // This happens on the first load or when migrating from angular
    return {};
  }

  // This migration aims to keep the most recent changes up-to-date
  // Plugins should explicitly migrate for known version changes and only use this
  // as a backup
  const old = panel.options as any;
  if (old.valueOptions) {
    const { valueOptions } = old;

    const fieldOptions = (old.fieldOptions = {} as FieldDisplayOptions);
    fieldOptions.mappings = old.valueMappings;
    fieldOptions.thresholds = old.thresholds;

    const field = (fieldOptions.defaults = {} as Field);
    if (valueOptions) {
      field.unit = valueOptions.unit;
      field.decimals = valueOptions.decimals;

      // Make sure the stats have a valid name
      if (valueOptions.stat) {
        fieldOptions.calcs = getFieldReducers([valueOptions.stat]).map(s => s.id);
      }
    }

    field.min = old.minValue;
    field.max = old.maxValue;

    // remove old props
    return omit(old, 'valueMappings', 'thresholds', 'valueOptions', 'minValue', 'maxValue');
  }

  return panel.options;
};
