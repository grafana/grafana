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
  FieldDisplayOptions,
  ConfigOverrideRule,
  ThresholdsMode,
  ThresholdsConfig,
  validateFieldConfig,
  FieldColorMode,
} from '@grafana/data';

export interface SingleStatBaseOptions {
  fieldOptions: FieldDisplayOptions;
  orientation: VizOrientation;
}

const optionsToKeep = ['fieldOptions', 'orientation'];

export function sharedSingleStatPanelChangedHandler(
  options: Partial<SingleStatBaseOptions> | any,
  prevPluginId: string,
  prevOptions: any
) {
  // Migrating from angular singlestat
  if (prevPluginId === 'singlestat' && prevOptions.angular) {
    const panel = prevOptions.angular;
    const reducer = fieldReducers.getIfExists(panel.valueName);
    const options = {
      fieldOptions: {
        defaults: {} as FieldConfig,
        overrides: [] as ConfigOverrideRule[],
        calcs: [reducer ? reducer.id : ReducerID.mean],
      },
      orientation: VizOrientation.Horizontal,
    };

    const defaults = options.fieldOptions.defaults;
    if (panel.format) {
      defaults.unit = panel.format;
    }
    if (panel.nullPointMode) {
      defaults.nullValueMode = panel.nullPointMode;
    }
    if (panel.nullText) {
      defaults.noValue = panel.nullText;
    }
    if (panel.decimals || panel.decimals === 0) {
      defaults.decimals = panel.decimals;
    }

    // Convert thresholds and color values
    if (panel.thresholds && panel.colors) {
      const levels = panel.thresholds.split(',').map((strVale: string) => {
        return Number(strVale.trim());
      });

      // One more color than threshold
      const thresholds: Threshold[] = [];
      for (const color of panel.colors) {
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
    const mappings = convertOldAngularValueMapping(panel);
    if (mappings && mappings.length) {
      defaults.mappings = mappings;
    }

    if (panel.gauge && panel.gauge.show) {
      defaults.min = panel.gauge.minValue;
      defaults.max = panel.gauge.maxValue;
    }
    return options;
  }

  for (const k of optionsToKeep) {
    if (prevOptions.hasOwnProperty(k)) {
      options[k] = cloneDeep(prevOptions[k]);
    }
  }
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

  if (previousVersion < 6.6) {
    const { fieldOptions } = options;

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
        mode: FieldColorMode.Fixed,
        fixedColor: defaults.color,
      };
    }

    validateFieldConfig(defaults);
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
