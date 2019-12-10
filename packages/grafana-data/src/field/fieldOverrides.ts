import { MatcherConfig, FieldConfig, InterpolateFunction, GrafanaTheme, DataFrame, Field, FieldType } from '../types';
import { fieldMatchers, ReducerID, reduceField } from '../transformations';
import { FieldMatcher } from '../types/transformations';
import isNumber from 'lodash/isNumber';
import { getFieldProperties } from './fieldDisplay';
import { getDisplayProcessor } from './displayProcessor';

export interface DynamicConfigValue {
  path: string;
  value: any;
}

export interface ConfigOverrideRule {
  matcher: MatcherConfig;
  properties: DynamicConfigValue[];
}

export interface FieldConfigSource {
  // Defatuls applied to all numeric fields
  defaults: FieldConfig;

  // Rules to override individual values
  overrides: ConfigOverrideRule[];
}

interface OverrideProps {
  match: FieldMatcher;
  properties: DynamicConfigValue[];
}

interface GlobalMinMax {
  min: number;
  max: number;
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
export function prepareDataFramesForDisplay(
  data: DataFrame[],
  source: FieldConfigSource,
  replaceVariables: InterpolateFunction,
  theme: GrafanaTheme,
  isUtc?: boolean
): DataFrame[] {
  if (!source) {
    return data;
  }
  let range: GlobalMinMax | undefined = undefined;

  // Prepare the Matchers
  const override: OverrideProps[] = [];
  if (source.overrides) {
    for (const rule of source.overrides) {
      const info = fieldMatchers.get(rule.matcher.id);
      if (info) {
        override.push({
          match: info.get(rule.matcher),
          properties: rule.properties,
        });
      }
    }
  }

  return data.map((frame, index) => {
    let name = frame.name;
    if (!name) {
      name = `Series[${index}]`;
    }

    const fields = frame.fields.map(field => {
      let config: FieldConfig = field.config || {};
      if (field.type === FieldType.number) {
        config = getFieldProperties(config, source.defaults);
      }
      // Find any matching rules and then override
      for (const rule of override) {
        if (rule.match(field)) {
          for (const prop of rule.properties) {
            config = applyDynamicConfigValue({
              value: prop,
              config,
              field,
              data: frame,
              replaceVariables,
            });
          }
        }
      }

      // Set the Min/Max value automatically
      if (field.type === FieldType.number) {
        if (!isNumber(config.min) || !isNumber(config.max)) {
          if (!range) {
            range = findNumericFieldMinMax(data);
          }
          if (!isNumber(config.min)) {
            config = {
              ...config,
              min: range.min,
            };
          }
          if (!isNumber(config.max)) {
            config = {
              ...config,
              max: range.max,
            };
          }
        }
      }

      return {
        ...field,

        // Overwrite the configs
        config,

        // Set the display processor
        processor: getDisplayProcessor({
          type: field.type,
          config: config,
          theme,
          isUtc,
        }),
      };
    });

    return {
      ...frame,
      fields,
      name,
    };
  });
}

interface DynamicConfigValueOptions {
  value: DynamicConfigValue;
  config: FieldConfig;
  field: Field;
  data: DataFrame;
  replaceVariables: InterpolateFunction;
}

export function applyDynamicConfigValue(options: DynamicConfigValueOptions): FieldConfig {
  const { value } = options;
  const config = { ...options.config };
  (config as any)[value.path] = value.value;
  // TODO... depending on type... need to convert string to number etc
  return config;
}
