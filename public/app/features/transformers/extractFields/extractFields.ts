import { isString } from 'lodash';
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

import { FieldExtractorID, fieldExtractors } from './fieldExtractors';

export interface ExtractFieldsOptions {
  source?: string;
  format?: FieldExtractorID;
  replace?: boolean;
}

export const extractFieldsTransformer: SynchronousDataTransformerInfo<ExtractFieldsOptions> = {
  id: DataTransformerID.extractFields,
  name: 'Extract fields',
  description: 'Parse fields from the contends of another',
  defaultOptions: {},

  operator: (options) => (source) => source.pipe(map((data) => extractFieldsTransformer.transformer(options)(data))),

  transformer: (options: ExtractFieldsOptions) => {
    return (data: DataFrame[]) => {
      return data.map((v) => addExtractedFields(v, options));
    };
  },
};

function addExtractedFields(frame: DataFrame, options: ExtractFieldsOptions): DataFrame {
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
    const buffer = values.get(name);
    return {
      name,
      values: new ArrayVector(buffer),
      type: buffer ? getFieldTypeFromValue(buffer.find((v) => v != null)) : FieldType.other,
      config: {},
    } as Field;
  });

  if (!options.replace) {
    fields.unshift(...frame.fields);
  }
  return {
    ...frame,
    fields,
  };
}
