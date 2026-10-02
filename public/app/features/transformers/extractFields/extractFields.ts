import { isString, get } from 'lodash';
import { map } from 'rxjs/operators';

import {
  type DataFrame,
  DataTransformerID,
  type Field,
  FieldType,
  getFieldTypeFromValue,
  type SynchronousDataTransformerInfo,
} from '@grafana/data';
import { findField } from 'app/features/dimensions/utils';

import { fieldExtractors } from './fieldExtractors';
import { type ExtractFieldsOptions, FieldExtractorID, type JSONPath } from './types';

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

  const sourceTime = options.keepTime ? findField(frame, 'Time') || findField(frame, 'time') : undefined;

  // Only names that actually survive into the output can force a rename: `replace` discards the
  // original fields, and each extracted name has to be deduped against the ones already assigned
  // here, not just against the incoming frame.
  const taken = new Set<string>();
  if (!options.replace) {
    frame.fields.forEach((f) => taken.add(f.name));
  }
  if (sourceTime) {
    taken.add(sourceTime.name);
  }

  const fields = names.map((name) => {
    const buffer = values.get(name);
    // this should never happen, but let's be safe
    if (!buffer) {
      throw new Error(`Could not find field with name: ${name}`);
    }

    let unique = name;
    for (let dupe = 1; taken.has(unique); dupe++) {
      unique = `${name} ${dupe}`;
    }
    taken.add(unique);

    const field: Field = {
      name: unique,
      values: buffer,
      type: buffer ? getFieldTypeFromValue(buffer.find((v) => v != null)) : FieldType.other,
      config: {},
    };
    return field;
  });

  if (sourceTime) {
    fields.unshift(sourceTime);
  }

  if (!options.replace) {
    fields.unshift(...frame.fields);
  }

  return {
    ...frame,
    fields,
  };
}
