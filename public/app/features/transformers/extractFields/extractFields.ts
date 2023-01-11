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

import { fieldExtractors } from './fieldExtractors';
import { ExtractFieldsOptions, FieldExtractorID, JSONPath, SourceField } from './types';

export const extractFieldsTransformer: SynchronousDataTransformerInfo<ExtractFieldsOptions> = {
  id: DataTransformerID.extractFields,
  name: 'Extract fields',
  description: 'Parse fields from the contends of another',
  defaultOptions: {},

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => extractFieldsTransformer.transformer(options, ctx)(data))),

  transformer: (options: ExtractFieldsOptions) => {
    return (data: DataFrame[]) => {
      return data.map((v) => addExtractedFields(v, options));
    };
  },
};

function addExtractedFields(frame: DataFrame, options: ExtractFieldsOptions): DataFrame {
  if (options.sources?.length === 0) {
    return frame;
  }

  const fields: Field[] = [];
  options.sources?.forEach((field: SourceField) => {
    if (!field.source) {
      return frame;
    }

    const source = findField(frame, field.source);

    if (!source) {
      // this case can happen when there are multiple queries
      return frame;
    }

    const ext = fieldExtractors.getIfExists(field.format ?? FieldExtractorID.Auto);
    if (!ext) {
      throw new Error('unkonwn extractor');
    }

    const count = frame.length;
    const names: string[] = []; // keep order
    const values = new Map<string, any[]>();

    for (let i = 0; i < count; i++) {
      let obj = source.values.get(i);

      if (isString(obj)) {
        try {
          obj = ext.parse(obj);
        } catch {
          obj = {}; // empty
        }
      }

      if (field.format === FieldExtractorID.JSON && field.jsonPaths && field.jsonPaths?.length > 0) {
        const newObj: { [k: string]: unknown } = {};
        // filter out empty paths
        const filteredPaths = field.jsonPaths.filter((path: JSONPath) => path.path);
        filteredPaths.forEach((path: JSONPath) => {
          if (path.path === '*' && path.alias) {
            // Hacky way to alias normal strings via JSON Path *
            if (Object.keys(obj).length === 0) {
              obj = source.values.get(i);
            }

            newObj[path.alias] = obj;
            return;
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
      } as Field;
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
