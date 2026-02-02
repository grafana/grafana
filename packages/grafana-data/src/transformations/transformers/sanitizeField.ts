import { map } from 'rxjs/operators';

import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { SynchronousDataTransformerInfo } from '../../types/transformations';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';

export interface SanitizeFieldTransformerOptions {
  sanitizers: SanitizeFieldOptions[];
}

export interface SanitizeFieldOptions {
  /**
   * The field to convert field type
   */
  targetField?: string;
}

export const sanitizeFieldTransformer: SynchronousDataTransformerInfo<SanitizeFieldTransformerOptions> = {
  id: DataTransformerID.sanitizeFunctions,
  name: 'Sanitize fields',
  description: 'Sanitize a field to plain text',
  defaultOptions: {
    fields: {},
    sanitizers: [{ targetField: undefined }],
  },

  operator: (options, ctx) => (source) =>
    source.pipe(map((data) => sanitizeFieldTransformer.transformer(options, ctx)(data))),

  transformer: (options: SanitizeFieldTransformerOptions) => (data: DataFrame[]) => {
    if (!Array.isArray(data) || data.length === 0) {
      return data;
    }
    return sanitizeFields(options, data) ?? [];
  },
};

/**
 * HTML sanitizer fields for dataframe(s)
 * @param options - field type conversion options
 * @param frames - dataframe(s) with field types to convert
 * @returns dataframe(s) with converted field types
 */
export function sanitizeFields(options: SanitizeFieldTransformerOptions, frames: DataFrame[]): DataFrame[] {
  if (!options.sanitizers.length) {
    return frames;
  }

  const framesCopy = frames.map((frame) => ({ ...frame }));

  for (const sanitizer of options.sanitizers) {
    if (!sanitizer.targetField) {
      continue;
    }
    const matches = fieldMatchers.get(FieldMatcherID.byName).get(sanitizer.targetField);
    for (const frame of framesCopy) {
      frame.fields = frame.fields.map((field) => {
        if (matches(field, frame, framesCopy)) {
          return sanitizeField(field, sanitizer);
        }
        return field;
      });
    }
  }

  return framesCopy;
}

/**
 * Sanitize a html field to string.
 * @param field - field to convert
 * @returns sanitized string
 *
 * @internal
 */
export function sanitizeField(field: Field, opts: SanitizeFieldOptions): Field {
  return fieldToStringField(field);
}

function fieldToStringField(field: Field): Field {
  let values = field.values.toArray();

  values = values.map((v) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(v, 'text/html');
    return doc.body.textContent?.trim() || '';
  });

  return {
    ...field,
    type: FieldType.string,
    values: values,
  };
}
