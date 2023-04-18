import { map } from 'rxjs/operators';

import { dateTimeParse } from '../../datetime';
import { SynchronousDataTransformerInfo } from '../../types';
import { DataFrame, EnumFieldConfig, Field, FieldType } from '../../types/dataFrame';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';

export interface ConvertFieldTypeTransformerOptions {
  conversions: ConvertFieldTypeOptions[];
}

export interface ConvertFieldTypeOptions {
  /**
   * The field to convert field type
   */
  targetField?: string;
  /**
   * The field type to convert to
   */
  destinationType?: FieldType;
  /**
   * Date format to parse a string datetime
   */
  dateFormat?: string;

  /** When converting to an enumeration, this is the target config */
  enumConfig?: EnumFieldConfig;
}

export const convertFieldTypeTransformer: SynchronousDataTransformerInfo<ConvertFieldTypeTransformerOptions> = {
  id: DataTransformerID.convertFieldType,
  name: 'Convert field type',
  description: 'Convert a field to a specified field type',
  defaultOptions: {
    fields: {},
    conversions: [{ targetField: undefined, destinationType: undefined, dateFormat: undefined }],
  },

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => convertFieldTypeTransformer.transformer(options, ctx)(data))),

  transformer: (options: ConvertFieldTypeTransformerOptions) => (data: DataFrame[]) => {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }
    return convertFieldTypes(options, data) ?? [];
  },
};

/**
 * Convert field types for dataframe(s)
 * @param options - field type conversion options
 * @param frames - dataframe(s) with field types to convert
 * @returns dataframe(s) with converted field types
 */
export function convertFieldTypes(options: ConvertFieldTypeTransformerOptions, frames: DataFrame[]): DataFrame[] {
  if (!options.conversions.length) {
    return frames;
  }

  const framesCopy = frames.map((frame) => ({ ...frame }));

  for (const conversion of options.conversions) {
    if (!conversion.targetField) {
      continue;
    }
    const matches = fieldMatchers.get(FieldMatcherID.byName).get(conversion.targetField);
    for (const frame of framesCopy) {
      frame.fields = frame.fields.map((field) => {
        if (matches(field, frame, framesCopy)) {
          return convertFieldType(field, conversion);
        }
        return field;
      });
    }
  }

  return framesCopy;
}

/**
 * Convert a single field type to specified field type.
 * @param field - field to convert
 * @param opts - field conversion options
 * @returns converted field
 *
 * @internal
 */
export function convertFieldType(field: Field, opts: ConvertFieldTypeOptions): Field {
  switch (opts.destinationType) {
    case FieldType.time:
      return ensureTimeField(field, opts.dateFormat);
    case FieldType.number:
      return fieldToNumberField(field);
    case FieldType.string:
      return fieldToStringField(field, opts.dateFormat);
    case FieldType.boolean:
      return fieldToBooleanField(field);
    case FieldType.enum:
      return fieldToEnumField(field, opts.enumConfig);
    case FieldType.other:
      return fieldToComplexField(field);
    default:
      return field;
  }
}

// matches common ISO 8601 (see tests)
const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,})?(?:Z|[-+]\d{2}:?\d{2})$/;

/**
 * @internal
 */
export function fieldToTimeField(field: Field, dateFormat?: string): Field {
  let opts = dateFormat ? { format: dateFormat } : undefined;

  const timeValues = field.values.slice();

  let firstDefined = timeValues.find((v) => v != null);

  let isISO8601 = typeof firstDefined === 'string' && iso8601Regex.test(firstDefined);

  for (let t = 0; t < timeValues.length; t++) {
    if (timeValues[t]) {
      let parsed = isISO8601 ? Date.parse(timeValues[t]) : dateTimeParse(timeValues[t], opts).valueOf();
      timeValues[t] = Number.isFinite(parsed) ? parsed : null;
    } else {
      timeValues[t] = null;
    }
  }

  return {
    ...field,
    type: FieldType.time,
    values: timeValues,
  };
}

function fieldToNumberField(field: Field): Field {
  const numValues = field.values.slice();

  const valuesAsStrings = numValues.some((v) => typeof v === 'string');

  for (let n = 0; n < numValues.length; n++) {
    let toBeConverted = numValues[n];

    if (valuesAsStrings) {
      // some numbers returned from datasources have commas
      // strip the commas, coerce the string to a number
      toBeConverted = toBeConverted.replace(/,/g, '');
    }

    const number = +toBeConverted;

    numValues[n] = Number.isFinite(number) ? number : null;
  }

  return {
    ...field,
    type: FieldType.number,
    values: numValues,
  };
}

function fieldToBooleanField(field: Field): Field {
  const booleanValues = field.values.slice();

  for (let b = 0; b < booleanValues.length; b++) {
    booleanValues[b] = Boolean(!!booleanValues[b]);
  }

  return {
    ...field,
    type: FieldType.boolean,
    values: booleanValues,
  };
}

function fieldToStringField(field: Field, dateFormat?: string): Field {
  let values = field.values;

  switch (field.type) {
    case FieldType.time:
      values = values.map((v) => dateTimeParse(v).format(dateFormat));
      break;

    case FieldType.other:
      values = values.map((v) => JSON.stringify(v));
      break;

    default:
      values = values.map((v) => `${v}`);
  }

  return {
    ...field,
    type: FieldType.string,
    values: values,
  };
}

function fieldToComplexField(field: Field): Field {
  const complexValues = field.values.slice();

  for (let s = 0; s < complexValues.length; s++) {
    try {
      complexValues[s] = JSON.parse(complexValues[s]);
    } catch {
      complexValues[s] = null;
    }
  }

  return {
    ...field,
    type: FieldType.other,
    values: complexValues,
  };
}

/**
 * Checks the first value. Assumes any number should be time fieldtype. Otherwise attempts to make the fieldtype time.
 * @param field - field to ensure is a time fieldtype
 * @param dateFormat - date format used to parse a string datetime
 * @returns field as time
 *
 * @public
 */
export function ensureTimeField(field: Field, dateFormat?: string): Field {
  const firstValueTypeIsNumber = typeof field.values[0] === 'number';
  if (field.type === FieldType.time && firstValueTypeIsNumber) {
    return field; //already time
  }
  if (firstValueTypeIsNumber) {
    return {
      ...field,
      type: FieldType.time, //assumes it should be time
    };
  }
  return fieldToTimeField(field, dateFormat);
}

function fieldToEnumField(field: Field, cfg?: EnumFieldConfig): Field {
  const enumConfig = { ...cfg };
  const enumValues = field.values.slice();
  const lookup = new Map<unknown, number>();
  if (enumConfig.text) {
    for (let i = 0; i < enumConfig.text.length; i++) {
      lookup.set(enumConfig.text[i], i);
    }
  } else {
    enumConfig.text = [];
  }

  for (let i = 0; i < enumValues.length; i++) {
    const v = enumValues[i];
    if (!lookup.has(v)) {
      enumConfig.text[lookup.size] = v;
      lookup.set(v, lookup.size);
    }
    enumValues[i] = lookup.get(v);
  }

  return {
    ...field,
    config: {
      ...field.config,
      type: {
        enum: enumConfig,
      },
    },
    type: FieldType.enum,
    values: enumValues,
  };
}
