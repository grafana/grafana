import {
  GrafanaTheme,
  DynamicConfigValue,
  FieldConfig,
  InterpolateFunction,
  DataFrame,
  Field,
  FieldType,
  FieldConfigSource,
  ThresholdsMode,
  FieldColorMode,
  ColorScheme,
  TimeZone,
  FieldConfigEditorRegistry,
  FieldOverrideContext,
  ScopedVars,
} from '../types';
import { fieldMatchers, ReducerID, reduceField } from '../transformations';
import { FieldMatcher } from '../types/transformations';
import isNumber from 'lodash/isNumber';
import { getDisplayProcessor } from './displayProcessor';
import { guessFieldTypeForField } from '../dataframe';
import { standardFieldConfigEditorRegistry } from './standardFieldConfigEditorRegistry';

interface OverrideProps {
  match: FieldMatcher;
  properties: DynamicConfigValue[];
}

interface GlobalMinMax {
  min: number;
  max: number;
}

export interface ApplyFieldOverrideOptions {
  data?: DataFrame[];
  fieldOptions: FieldConfigSource;
  replaceVariables: InterpolateFunction;
  theme: GrafanaTheme;
  timeZone?: TimeZone;
  autoMinMax?: boolean;
  standard?: FieldConfigEditorRegistry;
  custom?: FieldConfigEditorRegistry;
}

export function findNumericFieldMinMax(data: DataFrame[]): GlobalMinMax {
  let min = Number.MAX_VALUE;
  let max = Number.MIN_VALUE;

  const reducers = [ReducerID.min, ReducerID.max];
  for (const frame of data) {
    for (const field of frame.fields) {
      if (field.type === FieldType.number) {
        const stats = reduceField({ field, reducers });
        if (stats[ReducerID.min] < min) {
          min = stats[ReducerID.min];
        }
        if (stats[ReducerID.max] > max) {
          max = stats[ReducerID.max];
        }
      }
    }
  }

  return { min, max };
}

/**
 * Return a copy of the DataFrame with all rules applied
 */
export function applyFieldOverrides(options: ApplyFieldOverrideOptions): DataFrame[] {
  const scopedVars: ScopedVars = {};
  if (!options.data) {
    return [];
  }

  const source = options.fieldOptions;
  if (!source) {
    return options.data;
  }

  let range: GlobalMinMax | undefined = undefined;

  // Prepare the Matchers
  const override: OverrideProps[] = [];
  if (source.overrides) {
    for (const rule of source.overrides) {
      const info = fieldMatchers.get(rule.matcher.id);
      if (info) {
        override.push({
          match: info.get(rule.matcher.options),
          properties: rule.properties,
        });
      }
    }
  }

  return options.data.map((frame, index) => {
    let name = frame.name;
    if (!name) {
      name = `Series[${index}]`;
    }
    scopedVars['__series'] = { text: 'Series', value: { name } };

    const fields: Field[] = frame.fields.map((field, fieldIndex) => {
      // Config is mutable within this scope
      let fieldName = field.name;
      if (!fieldName) {
        fieldName = `Field[${fieldIndex}]`;
      }

      scopedVars['__field'] = { text: 'Field', value: { name: fieldName } };

      const config: FieldConfig = { ...field.config, scopedVars } || {};
      const context = {
        field,
        data: options.data!,
        dataFrameIndex: index,
        replaceVariables: options.replaceVariables,
        custom: options.custom,
      };

      // Anything in the field config that's not set by the datasource
      // will be filled in by panel's field configuration
      setFieldConfigDefaults(config, source.defaults, context);

      // Find any matching rules and then override
      for (const rule of override) {
        if (rule.match(field)) {
          for (const prop of rule.properties) {
            // config.scopedVars is set already here
            setDynamicConfigValue(config, prop, context);
          }
        }
      }

      // console.log(config)

      // Try harder to set a real value that is not 'other'
      let type = field.type;
      if (!type || type === FieldType.other) {
        const t = guessFieldTypeForField(field);
        if (t) {
          type = t;
        }
      }

      // Some units have an implied range
      if (config.unit === 'percent') {
        if (!isNumber(config.min)) {
          config.min = 0;
        }
        if (!isNumber(config.max)) {
          config.max = 100;
        }
      } else if (config.unit === 'percentunit') {
        if (!isNumber(config.min)) {
          config.min = 0;
        }
        if (!isNumber(config.max)) {
          config.max = 1;
        }
      }

      // Set the Min/Max value automatically
      if (options.autoMinMax && field.type === FieldType.number) {
        if (!isNumber(config.min) || !isNumber(config.max)) {
          if (!range) {
            range = findNumericFieldMinMax(options.data!); // Global value
          }
          if (!isNumber(config.min)) {
            config.min = range.min;
          }
          if (!isNumber(config.max)) {
            config.max = range.max;
          }
        }
      }

      // Overwrite the configs
      const f: Field = {
        ...field,
        config,
        type,
      };
      // and set the display processor using it
      f.display = getDisplayProcessor({
        field: f,
        theme: options.theme,
        timeZone: options.timeZone,
      });
      return f;
    });

    return {
      ...frame,
      fields,
      name,
    };
  });
}

export interface FieldOverrideEnv extends FieldOverrideContext {
  custom?: FieldConfigEditorRegistry;
}

function setDynamicConfigValue(config: FieldConfig, value: DynamicConfigValue, context: FieldOverrideEnv) {
  const reg = value.custom ? context.custom : standardFieldConfigEditorRegistry;

  const item = reg?.getIfExists(value.prop);
  if (!item || !item.shouldApply(context.field!)) {
    return;
  }

  const val = item.process(value.value, context, item.settings);

  const remove = val === undefined || val === null;

  if (remove) {
    if (value.custom) {
      delete (config?.custom as any)[value.prop];
    } else {
      delete (config as any)[value.prop];
    }
  } else {
    if (value.custom) {
      if (!config.custom) {
        config.custom = {};
      }
      config.custom[value.prop] = val;
    } else {
      (config as any)[value.prop] = val;
    }
  }
}

// config -> from DS
// defaults -> from Panel config
export function setFieldConfigDefaults(config: FieldConfig, defaults: FieldConfig, context: FieldOverrideEnv) {
  if (defaults) {
    const keys = Object.keys(defaults);

    for (const key of keys) {
      if (key === 'custom') {
        if (!context.custom) {
          continue;
        }
        if (!config.custom) {
          config.custom = {};
        }
        const customKeys = Object.keys(defaults.custom!);

        for (const customKey of customKeys) {
          processFieldConfigValue(config.custom!, defaults.custom!, customKey, context.custom, context);
        }
      } else {
        // when config from ds exists for a given field -> use it
        processFieldConfigValue(config, defaults, key, standardFieldConfigEditorRegistry, context);
      }
    }
  }
  validateFieldConfig(config);
}

const processFieldConfigValue = (
  destination: Record<string, any>, // it's mutable
  source: Record<string, any>,
  key: string,
  registry: FieldConfigEditorRegistry,
  context: FieldOverrideContext
) => {
  const currentConfig = destination[key];
  if (currentConfig === null || currentConfig === undefined) {
    const item = registry.getIfExists(key);
    if (item && item.shouldApply(context.field!)) {
      const val = item.process(source[key], context, item.settings);
      if (val !== undefined && val !== null) {
        destination[key] = val;
      }
    }
  }
};

/**
 * This checks that all options on FieldConfig make sense.  It mutates any value that needs
 * fixed.  In particular this makes sure that the first threshold value is -Infinity (not valid in JSON)
 */
export function validateFieldConfig(config: FieldConfig) {
  const { thresholds } = config;
  if (thresholds) {
    if (!thresholds.mode) {
      thresholds.mode = ThresholdsMode.Absolute;
    }
    if (!thresholds.steps) {
      thresholds.steps = [];
    } else if (thresholds.steps.length) {
      // First value is always -Infinity
      // JSON saves it as null
      thresholds.steps[0].value = -Infinity;
    }
  }

  if (!config.color) {
    if (thresholds) {
      config.color = {
        mode: FieldColorMode.Thresholds,
      };
    }
    // No Color settings
  } else if (!config.color.mode) {
    // Without a mode, skip color altogether
    delete config.color;
  } else {
    const { color } = config;
    if (color.mode === FieldColorMode.Scheme) {
      if (!color.schemeName) {
        color.schemeName = ColorScheme.BrBG;
      }
    } else {
      delete color.schemeName;
    }
  }

  // Verify that max > min (swap if necessary)
  if (config.hasOwnProperty('min') && config.hasOwnProperty('max') && config.min! > config.max!) {
    const tmp = config.max;
    config.max = config.min;
    config.min = tmp;
  }
}
