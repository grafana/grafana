import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  Field,
  FieldType,
  guessFieldTypeForField,
  parseLabels,
  SynchronousDataTransformerInfo,
} from '@grafana/data';
import { findField } from 'app/features/dimensions';
import { isString } from 'lodash';
import { map } from 'rxjs/operators';

export interface FieldsFromJSONOptions {
  field: string;
  replace?: boolean;
}

export const fieldsFromJSONTransformer: SynchronousDataTransformerInfo<FieldsFromJSONOptions> = {
  id: DataTransformerID.fieldsFromJSON,
  name: 'Fields from JSON',
  description: 'Extract JSON body into fields',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(map((data) => fieldsFromJSONTransformer.transformer(options)(data))),

  transformer: (options: FieldsFromJSONOptions) => {
    return (data: DataFrame[]) => {
      return data.map((v) => addFieldsFromJSON(v, options));
    };
  },
};

function addFieldsFromJSON(frame: DataFrame, options: FieldsFromJSONOptions): DataFrame {
  if (!options.field) {
    return frame;
  }
  const source = findField(frame, options.field);
  if (!source) {
    throw new Error('json field not found');
  }

  const count = frame.length;
  const names: string[] = []; // keep order
  const values = new Map<string, any[]>();

  for (let i = 0; i < count; i++) {
    let obj = source.values.get(i);
    if (isString(obj)) {
      try {
        obj = JSON.parse(obj);
      } catch {
        obj = parseLabels(obj);
      }
    }
    for (const [key, val] of Object.entries(obj)) {
      let buffer = values.get(key);
      if (buffer == null) {
        buffer = new Array(count);
        values.set(key, buffer);
        names.push(key);
      }
      buffer[i] = val;
    }
  }

  const fields = names.map((name) => {
    const f: Field = {
      name,
      values: new ArrayVector(values.get(name)),
      type: FieldType.boolean,
      config: {},
    };
    f.type = guessFieldTypeForField(f) ?? FieldType.other;
    return f;
  });

  if (!options.replace) {
    fields.unshift(...frame.fields);
  }
  return {
    ...frame,
    fields,
  };
}
