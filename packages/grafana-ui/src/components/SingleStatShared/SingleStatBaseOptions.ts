import cloneDeep from 'lodash/cloneDeep';
import omit from 'lodash/omit';

import {
  fieldReducers,
  Threshold,
  sortThresholds,
  FieldConfig,
  ReducerID,
  ValueMapping,
  MappingType,
  VizOrientation,
  PanelModel,
  ReduceDataOptions,
  ThresholdsMode,
  ThresholdsConfig,
  validateFieldConfig,
  FieldColorModeId,
} from '@grafana/data';

export interface SingleStatBaseOptions {
  reduceOptions: ReduceDataOptions;
  orientation: VizOrientation;
}

const optionsToKeep = ['reduceOptions', 'orientation'];

export function sharedSingleStatPanelChangedHandler(
  panel: PanelModel<Partial<SingleStatBaseOptions>> | any,
  prevPluginId: string,
  prevOptions: any
) {
  let options = panel.options;

  panel.fieldConfig = panel.fieldConfig || {
    defaults: {},
    overrides: [],
  };

  // Migrating from angular singlestat
  if (prevPluginId === 'singlestat' && prevOptions.angular) {
    return migrateFromAngularSinglestat(panel, prevOptions);
  }

  for (const k of optionsToKeep) {
    if (prevOptions.hasOwnProperty(k)) {
      options[k] = cloneDeep(prevOptions[k]);
    }
  }

  return options;
}

function migrateFromAngularSinglestat(panel: PanelModel<Partial<SingleStatBaseOptions>> | any, prevOptions: any) {
  const prevPanel = prevOptions.angular;
  const reducer = fieldReducers.getIfExists(prevPanel.valueName);
  const options = {
    reduceOptions: {
      calcs: [reducer ? reducer.id : ReducerID.mean],
    },
    orientation: VizOrientation.Horizontal,
  } as any;

  const defaults: FieldConfig = {};

  if (prevPanel.format) {
    defaults.unit = prevPanel.format;
  }

  if (prevPanel.tableColumn) {
    options.reduceOptions.fields = `/^${prevPanel.tableColumn}$/`;
  }

  if (prevPanel.nullPointMode) {
    defaults.nullValueMode = prevPanel.nullPointMode;
  }

  if (prevPanel.nullText) {
    defaults.noValue = prevPanel.nullText;
  }

  if (prevPanel.decimals || prevPanel.decimals === 0) {
    defaults.decimals = prevPanel.decimals;
  }

  // Convert thresholds and color values
  if (prevPanel.thresholds && prevPanel.colors) {
    const levels = prevPanel.thresholds.split(',').map((strVale: string) => {
      return Number(strVale.trim());
    });

    // One more color than threshold
    const thresholds: Threshold[] = [];
    for (const color of prevPanel.colors) {
      const idx = thresholds.length - 1;
      if (idx >= 0) {
        thresholds.push({ value: levels[idx], color });
      } else {
        thresholds.push({ value: -Infinity, color });
      }
    }

    defaults.thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: thresholds,
    };
  }

  // Convert value mappings
  const mappings = convertOldAngularValueMapping(prevPanel);
  if (mappings && mappings.length) {
    defaults.mappings = mappings;
  }

  if (prevPanel.gauge && prevPanel.gauge.show) {
    defaults.min = prevPanel.gauge.minValue;
    defaults.max = prevPanel.gauge.maxValue;
  }

  panel.fieldConfig.defaults = defaults;

  return options;
}

export function sharedSingleStatMigrationHandler(panel: PanelModel<SingleStatBaseOptions>): SingleStatBaseOptions {
  if (!panel.options) {
    // This happens on the first load or when migrating from angular
    return {} as any;
  }

  const previousVersion = parseFloat(panel.pluginVersion || '6.1');
  let options = panel.options as any;

  if (previousVersion < 6.2) {
    options = migrateFromValueOptions(options);
  }

  if (previousVersion < 6.3) {
    options = moveThresholdsAndMappingsToField(options);
  }

  const { fieldOptions } = options;

  if (previousVersion < 6.6 && fieldOptions) {
    // discard the old `override` options and enter an empty array
    if (fieldOptions && fieldOptions.override) {
      const { override, ...rest } = options.fieldOptions;
      options = {
        ...options,
        fieldOptions: {
          ...rest,
          overrides: [],
        },
      };
    }

    // Move thresholds to steps
    let thresholds = fieldOptions?.defaults?.thresholds;
    if (thresholds) {
      delete fieldOptions.defaults.thresholds;
    } else {
      thresholds = fieldOptions?.thresholds;
      delete fieldOptions.thresholds;
    }

    if (thresholds) {
      fieldOptions.defaults.thresholds = {
        mode: ThresholdsMode.Absolute,
        steps: thresholds,
      };
    }

    // Migrate color from simple string to a mode
    const { defaults } = fieldOptions;
    if (defaults.color && typeof defaults.color === 'string') {
      defaults.color = {
        mode: FieldColorModeId.Fixed,
        fixedColor: defaults.color,
      };
    }

    validateFieldConfig(defaults);
  }

  if (previousVersion < 7.0) {
    panel.fieldConfig = panel.fieldConfig || { defaults: {}, overrides: [] };
    panel.fieldConfig = {
      defaults:
        fieldOptions && fieldOptions.defaults
          ? { ...panel.fieldConfig.defaults, ...fieldOptions.defaults }
          : panel.fieldConfig.defaults,
      overrides:
        fieldOptions && fieldOptions.overrides
          ? [...panel.fieldConfig.overrides, ...fieldOptions.overrides]
          : panel.fieldConfig.overrides,
    };

    if (fieldOptions) {
      options.reduceOptions = {
        values: fieldOptions.values,
        limit: fieldOptions.limit,
        calcs: fieldOptions.calcs,
      };
    }

    delete options.fieldOptions;
  }

  if (previousVersion < 7.1) {
    // move title to displayName
    const oldTitle = (panel.fieldConfig.defaults as any).title;
    if (oldTitle !== undefined && oldTitle !== null) {
      panel.fieldConfig.defaults.displayName = oldTitle;
      delete (panel.fieldConfig.defaults as any).title;
    }
  }

  return options as SingleStatBaseOptions;
}

export function moveThresholdsAndMappingsToField(old: any) {
  const { fieldOptions } = old;

  if (!fieldOptions) {
    return old;
  }

  const { mappings, ...rest } = old.fieldOptions;

  let thresholds: ThresholdsConfig | undefined = undefined;
  if (old.thresholds) {
    thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: migrateOldThresholds(old.thresholds)!,
    };
  }

  return {
    ...old,
    fieldOptions: {
      ...rest,
      defaults: {
        ...fieldOptions.defaults,
        mappings,
        thresholds,
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

/**
 * Convert the angular single stat mapping to new react style
 */
export function convertOldAngularValueMapping(panel: any): ValueMapping[] {
  const mappings: ValueMapping[] = [];

  // Guess the right type based on options
  let mappingType = panel.mappingType;
  if (!panel.mappingType) {
    if (panel.valueMaps && panel.valueMaps.length) {
      mappingType = 1;
    } else if (panel.rangeMaps && panel.rangeMaps.length) {
      mappingType = 2;
    }
  }

  // check value to text mappings if its enabled
  if (mappingType === 1) {
    for (let i = 0; i < panel.valueMaps.length; i++) {
      const map = panel.valueMaps[i];
      mappings.push({
        ...map,
        id: i, // used for order
        type: MappingType.ValueToText,
      });
    }
  } else if (mappingType === 2) {
    for (let i = 0; i < panel.rangeMaps.length; i++) {
      const map = panel.rangeMaps[i];
      mappings.push({
        ...map,
        id: i, // used for order
        type: MappingType.RangeToText,
      });
    }
  }

  return mappings;
}
