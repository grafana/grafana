import { SynchronousDataTransformerInfo } from '../../types';
import { map } from 'rxjs/operators';

import { DataTransformerID } from './ids';
import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { dateTimeParse } from '../../datetime';
import { ArrayVector } from '../../vector';

export interface ConvertFieldTypeTransformerOptions {
  conversions: ConvertFieldTypeOptions[];
}

export interface ConvertFieldTypeOptions {
  targetField?: string;
  destinationType?: FieldType;
  dateFormat?: string;
}

/**
 * @alpha
 */
export const convertFieldTypeTransformer: SynchronousDataTransformerInfo<ConvertFieldTypeTransformerOptions> = {
  id: DataTransformerID.convertFieldType,
  name: 'Convert field type',
  description: 'Convert a field to a specified field type',
  defaultOptions: {
    fields: {},
    conversions: [{ targetField: undefined, destinationType: undefined, dateFormat: undefined }],
  },

  operator: (options) => (source) => source.pipe(map((data) => convertFieldTypeTransformer.transformer(options)(data))),

  transformer: (options: ConvertFieldTypeTransformerOptions) => (data: DataFrame[]) => {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }
    const timeParsed = convertFieldTypes(options, data);
    if (!timeParsed) {
      return [];
    }
    return timeParsed;
  },
};

/**
 * @alpha
 */
export function convertFieldTypes(options: ConvertFieldTypeTransformerOptions, frames: DataFrame[]): DataFrame[] {
  if (!options.conversions.length) {
    return frames;
  }

  const frameCopy: DataFrame[] = [];

  frames.forEach((frame) => {
    for (let fieldIdx = 0; fieldIdx < frame.fields.length; fieldIdx++) {
      let field = frame.fields[fieldIdx];
      for (let cIdx = 0; cIdx < options.conversions.length; cIdx++) {
        if (field.name === options.conversions[cIdx].targetField) {
          //check in about matchers with Ryan
          const conversion = options.conversions[cIdx];
          frame.fields[fieldIdx] = convertFieldType(field, conversion);
          break;
        }
      }
    }
    frameCopy.push(frame);
  });
  return frameCopy;
}

export function convertFieldType(field: Field, opts: ConvertFieldTypeOptions): Field {
  switch (opts.destinationType) {
    case FieldType.time:
      return ensureTimeField(field, opts.dateFormat);
    case FieldType.number:
      return fieldToNumberField(field);
    case FieldType.string:
      return fieldToStringField(field);
    case FieldType.boolean:
      return fieldToBooleanField(field);
    default:
      return field;
  }
}

export function fieldToTimeField(field: Field, dateFormat?: string): Field {
  let opts = dateFormat ? { format: dateFormat } : undefined;

  const timeValues = field.values.toArray().slice();

  for (let t = 0; t < timeValues.length; t++) {
    if (timeValues[t]) {
      let parsed = dateTimeParse(timeValues[t], opts).valueOf();
      timeValues[t] = Number.isFinite(parsed) ? parsed : null;
    } else {
      timeValues[t] = null;
    }
  }

  return {
    ...field,
    type: FieldType.time,
    values: new ArrayVector(timeValues),
  };
}

function fieldToNumberField(field: Field): Field {
  const numValues = field.values.toArray().slice();

  for (let n = 0; n < numValues.length; n++) {
    if (numValues[n]) {
      let number = +numValues[n];
      numValues[n] = Number.isFinite(number) ? number : null;
    } else {
      numValues[n] = null;
    }
  }

  return {
    ...field,
    type: FieldType.number,
    values: new ArrayVector(numValues),
  };
}

function fieldToBooleanField(field: Field): Field {
  const booleanValues = field.values.toArray().slice();

  for (let b = 0; b < booleanValues.length; b++) {
    booleanValues[b] = Boolean(booleanValues[b]);
  }

  return {
    ...field,
    type: FieldType.boolean,
    values: new ArrayVector(booleanValues),
  };
}

function fieldToStringField(field: Field): Field {
  const stringValues = field.values.toArray().slice();

  for (let s = 0; s < stringValues.length; s++) {
    stringValues[s] = `${stringValues[s]}`;
  }

  return {
    ...field,
    type: FieldType.string,
    values: new ArrayVector(stringValues),
  };
}

/**
 * @alpha
 */
export function ensureTimeField(field: Field, dateFormat?: string): Field {
  const firstValueTypeIsNumber = typeof field.values.get(0) === 'number';
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
