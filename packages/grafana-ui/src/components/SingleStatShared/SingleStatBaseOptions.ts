import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';

import { VizOrientation, PanelModel } from '../../types/panel';
import { FieldDisplayOptions } from '../../utils/fieldDisplay';
import { fieldReducers, Threshold, sortThresholds } from '@grafana/data';

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

export function sharedSingleStatMigrationCheck(panel: PanelModel<SingleStatBaseOptions>) {
  if (!panel.options) {
    // This happens on the first load or when migrating from angular
    return {};
  }

  const previousVersion = parseFloat(panel.pluginVersion || '6.1');
  let options = panel.options as any;

  if (previousVersion < 6.2) {
    options = migrateFromValueOptions(options);
  }

  if (previousVersion < 6.3) {
    options = moveThresholdsAndMappingsToField(options);
  }

  return options as SingleStatBaseOptions;
}

export function moveThresholdsAndMappingsToField(old: any) {
  const { fieldOptions } = old;

  if (!fieldOptions) {
    return old;
  }

  const { mappings, thresholds, ...rest } = old.fieldOptions;

  return {
    ...old,
    fieldOptions: {
      ...rest,
      defaults: {
        ...fieldOptions.defaults,
        mappings,
        thresholds: migrateOldThresholds(thresholds),
      },
    },
  };
}

/*
 * Moves valueMappings and thresholds from root to new fieldOptions object
 * Renames valueOptions to to defaults and moves it under fieldOptions
 */
export function migrateFromValueOptions(old: any) {
  const { valueOptions } = old;
  if (!valueOptions) {
    return old;
  }

  const fieldOptions: any = {};
  const fieldDefaults: any = {};

  fieldOptions.mappings = old.valueMappings;
  fieldOptions.thresholds = old.thresholds;
  fieldOptions.defaults = fieldDefaults;

  fieldDefaults.unit = valueOptions.unit;
  fieldDefaults.decimals = valueOptions.decimals;

  // Make sure the stats have a valid name
  if (valueOptions.stat) {
    const reducer = fieldReducers.get(valueOptions.stat);
    if (reducer) {
      fieldOptions.calcs = [reducer.id];
    }
  }

  fieldDefaults.min = old.minValue;
  fieldDefaults.max = old.maxValue;

  const newOptions = {
    ...old,
    fieldOptions,
  };

  return omit(newOptions, 'valueMappings', 'thresholds', 'valueOptions', 'minValue', 'maxValue');
}

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
