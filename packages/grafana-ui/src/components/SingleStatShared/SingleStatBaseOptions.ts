import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';

import { VizOrientation, PanelModel } from '../../types/panel';
import { FieldDisplayOptions } from '../../utils/fieldDisplay';
import { Field, fieldReducers, Threshold, sortThresholds } from '@grafana/data';

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

    const field = (fieldOptions.defaults = {} as Field);
    field.mappings = old.valueMappings;
    field.thresholds = migrateOldThresholds(old.thresholds);
    field.unit = valueOptions.unit;
    field.decimals = valueOptions.decimals;

    // Make sure the stats have a valid name
    if (valueOptions.stat) {
      const reducer = fieldReducers.get(valueOptions.stat);
      if (reducer) {
        fieldOptions.calcs = [reducer.id];
      }
    }

    field.min = old.minValue;
    field.max = old.maxValue;

    // remove old props
    return omit(old, 'valueMappings', 'thresholds', 'valueOptions', 'minValue', 'maxValue');
  } else if (old.fieldOptions) {
    // Move mappins & thresholds to field defautls (6.4+)
    const { mappings, thresholds, ...fieldOptions } = old.fieldOptions;
    fieldOptions.defaults = {
      mappings,
      thresholds: migrateOldThresholds(thresholds),
      ...fieldOptions.defaults,
    };
    old.fieldOptions = fieldOptions;
    return old;
  }

  return panel.options;
};

export function migrateOldThresholds(thresholds?: any[]): Threshold[] | undefined {
  if (!thresholds || !thresholds.length) {
    return undefined;
  }
  const copy = thresholds.map(t => {
    return {
      // Drops 'index'
      value: t.value === null ? -Infinity : t.value,
      color: t.color,
    };
  });
  sortThresholds(copy);
  copy[0].value = -Infinity;
  return copy;
}
