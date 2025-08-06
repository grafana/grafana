import { isString, get } from 'lodash';
import { map } from 'rxjs/operators';

import {
  DataFrame,
  DataTransformerID,
  Field,
  FieldType,
  getFieldTypeFromValue,
  getUniqueFieldName,
  SynchronousDataTransformerInfo,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { findField } from 'app/features/dimensions/utils';

import { fieldExtractors } from './fieldExtractors';
import { ExtractFieldsOptions, FieldExtractorID, JSONPath } from './types';

export const extractFieldsTransformer: SynchronousDataTransformerInfo<ExtractFieldsOptions> = {
  id: DataTransformerID.extractFields,
  name: 'Extract fields',
  description: 'Parse fields from the contends of another',
  defaultOptions: {
    delimiter: ',',
  },

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => extractFieldsTransformer.transformer(options, ctx)(data))),

  transformer: (options: ExtractFieldsOptions) => {
    return (data: DataFrame[]) => {
      return data.map((v) => addExtractedFields(v, options));
    };
  },
};

export function addExtractedFields(frame: DataFrame, options: ExtractFieldsOptions): DataFrame {
  if (!options.source) {
    return frame;
  }

  const source = findField(frame, options.source);

  if (!source) {
    // this case can happen when there are multiple queries
    return frame;
  }

  const ext = fieldExtractors.getIfExists(options.format ?? FieldExtractorID.Auto);
  if (!ext) {
    throw new Error('unkonwn extractor');
  }

  const count = frame.length;
  const names: string[] = []; // keep order
  const values = new Map<string, unknown[]>();
  const parse = ext.getParser(options);

  for (let i = 0; i < count; i++) {
    let obj = source.values[i];

    if (isString(obj)) {
      try {
        obj = parse(obj);
      } catch {
        obj = {}; // empty
      }
    }

    if (obj == null) {
      continue;
    }

    if (options.format === FieldExtractorID.JSON && options.jsonPaths && options.jsonPaths?.length > 0) {
      const newObj: { [k: string]: unknown } = {};
      // filter out empty paths
      const filteredPaths = options.jsonPaths.filter((path: JSONPath) => path.path);

      if (filteredPaths.length > 0) {
        filteredPaths.forEach((path: JSONPath) => {
          const key = path.alias && path.alias.length > 0 ? path.alias : path.path;
          newObj[key] = get(obj, path.path) ?? 'Not Found';
        });

        obj = newObj;
      }
    }

    for (const [key, val] of Object.entries(obj)) {
      let buffer = values.get(key);
      if (buffer == null) {
        buffer = new Array(count).fill(undefined);
        values.set(key, buffer);
        names.push(key);
      }
      buffer[i] = val;
    }
  }

  const fields = names.map((name) => {
    const buffer = values.get(name);
    // this should never happen, but let's be safe
    if (!buffer) {
      throw new Error(`Could not find field with name: ${name}`);
    }
    const field: Field = {
      name,
      values: buffer,
      type: buffer ? getFieldTypeFromValue(buffer.find((v) => v != null)) : FieldType.other,
      config: {},
    };
    if (config.featureToggles.extractFieldsNameDeduplication) {
      field.name = getUniqueFieldName(field, frame);
    }
    return field;
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
