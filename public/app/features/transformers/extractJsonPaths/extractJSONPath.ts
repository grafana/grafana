import { isString, get } from 'lodash';
import { map } from 'rxjs/operators';

import {
  ArrayVector,
  DataFrame,
  DataTransformerID,
  Field,
  FieldType,
  getFieldTypeFromValue,
  SynchronousDataTransformerInfo,
} from '@grafana/data';
import { findField } from 'app/features/dimensions';

import { JSONPath, ExtractJSONPathOptions, SourceField } from './types';

export const extractJSONPathTransformer: SynchronousDataTransformerInfo<ExtractJSONPathOptions> = {
  id: DataTransformerID.extractFields,
  name: 'Extract fields',
  description: 'Parse fields from the contends of another',
  defaultOptions: {},

  operator: (options: ExtractJSONPathOptions) => (source) =>
    source.pipe(map((data: DataFrame[]) => extractJSONPathTransformer.transformer(options)(data))),

  transformer: (options: ExtractJSONPathOptions) => {
    return (data: DataFrame[]) => {
      return data.map((v) => addExctractedJSONPathFields(v, options));
    };
  },
};

function addExctractedJSONPathFields(frame: DataFrame, options: ExtractJSONPathOptions): DataFrame {
  if (options.sources?.length === 0) {
    return frame;
  }

  const fields: Field[] = [];
  options.sources?.forEach((field: SourceField) => {
    if (!field.source) {
      return;
    }

    const source = findField(frame, field.source);

    if (!source) {
      // this case can happen when there are multiple queries
      return frame;
    }

    const count = frame.length;
    const names: string[] = []; // keep order
    const values = new Map<string, unknown[]>();

    for (let i = 0; i < count; i++) {
      let obj = source.values.get(i);

      if (field.paths?.length && field.paths?.length > 0) {
        const newObj: { [k: string]: unknown } = {};
        field.paths.filter(Boolean).forEach((path: JSONPath) => {
          if (path.path === '*') {
            const key = path.alias && path.alias.length > 0 ? path.alias : field.source;
            newObj[key] = obj;
            return;
          }

          if (isString(obj)) {
            try {
              obj = JSON.parse(obj);
            } catch {
              obj = {}; // empty
            }
          }

          const key = path.alias && path.alias.length > 0 ? path.alias : path.path;
          newObj[key] = get(obj, path.path) ?? 'Not Found';
        });

        obj = newObj;
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

    const newFields = names.map((name) => {
      const buffer = values.get(name);
      return {
        name,
        values: new ArrayVector(buffer),
        type: buffer ? getFieldTypeFromValue(buffer.find((v) => v != null)) : FieldType.other,
        config: {},
      };
    });

    fields.push(...newFields);
    return;
  });

  if (options.keepTime) {
    const sourceTime = findField(frame, 'Time') || findField(frame, 'time');
    if (sourceTime) {
      fields.unshift(sourceTime);
    }
  }

  if (!options.replace) {
    fields.unshift(...frame.fields);
  }

  return {
    ...frame,
    fields,
  };
}
