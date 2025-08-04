import { map } from 'rxjs/operators';

import { DataFrame, Field, FieldType } from '../../types/dataFrame';
import { DataTransformerInfo, FieldMatcher, TransformationApplicabilityLevels } from '../../types/transformations';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { DataTransformerID } from './ids';
import { parseTemplateTokens, processTemplateTokens } from './utils';

export enum FormatStringOutput {
  UpperCase = 'Upper Case',
  LowerCase = 'Lower Case',
  SentenceCase = 'Sentence Case',
  TitleCase = 'Title Case',
  PascalCase = 'Pascal Case',
  CamelCase = 'Camel Case',
  SnakeCase = 'Snake Case',
  KebabCase = 'Kebab Case',
  Trim = 'Trim',
  Substring = 'Substring',
  Affix = 'Affix',
}

export interface FormatStringTransformerOptions {
  stringField: string;
  substringStart: number;
  substringEnd: number;
  outputFormat: FormatStringOutput;
  stringPrefix: string;
  stringSuffix: string;
}

const splitToCapitalWords = (input: string) => {
  const arr = input.split(' ');
  for (let i = 0; i < arr.length; i++) {
    arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1).toLowerCase();
  }
  return arr;
};

export const getFormatStringFunction = (options: FormatStringTransformerOptions) => {
  return (field: Field, allFields: Field[]) =>
    field.values.map((value: string, index: number) => {
      switch (options.outputFormat) {
        case FormatStringOutput.UpperCase:
          return value.toUpperCase();
        case FormatStringOutput.LowerCase:
          return value.toLowerCase();
        case FormatStringOutput.SentenceCase:
          return value.charAt(0).toUpperCase() + value.slice(1);
        case FormatStringOutput.TitleCase:
          return splitToCapitalWords(value).join(' ');
        case FormatStringOutput.PascalCase:
          return splitToCapitalWords(value).join('');
        case FormatStringOutput.CamelCase:
          value = splitToCapitalWords(value).join('');
          return value.charAt(0).toLowerCase() + value.slice(1);
        case FormatStringOutput.SnakeCase:
          return value.toLowerCase().split(' ').join('_');
        case FormatStringOutput.KebabCase:
          return value.toLowerCase().split(' ').join('-');
        case FormatStringOutput.Trim:
          return value.trim();
        case FormatStringOutput.Substring:
          return value.substring(options.substringStart, options.substringEnd);
        case FormatStringOutput.Affix:
          const prefix = { value: options.stringPrefix ?? '' };
          const suffix = { value: options.stringSuffix ?? '' };

          [prefix, suffix].forEach((affix) => {
            const parsedTemplateTokens = parseTemplateTokens(affix.value);
            affix.value = processTemplateTokens(affix.value, parsedTemplateTokens, allFields, index);
          });

          return prefix.value + value + suffix.value;
      }
    });
};

export const formatStringTransformer: DataTransformerInfo<FormatStringTransformerOptions> = {
  id: DataTransformerID.formatString,
  name: 'Format string',
  description: 'Manipulate string fields formatting',
  defaultOptions: { stringField: '', outputFormat: FormatStringOutput.UpperCase },
  isApplicable: (data: DataFrame[]) => {
    // Search for a string field
    // if there is one then we can use this transformation
    for (const frame of data) {
      for (const field of frame.fields) {
        if (field.type === 'string') {
          return TransformationApplicabilityLevels.Applicable;
        }
      }
    }

    return TransformationApplicabilityLevels.NotApplicable;
  },
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        if (data.length === 0) {
          return data;
        }

        const fieldMatches = fieldMatchers.get(FieldMatcherID.byName).get(options.stringField);
        const formatStringFunction = getFormatStringFunction(options);

        const formatter = createStringFormatter(fieldMatches, formatStringFunction);

        return data.map((frame) => ({
          ...frame,
          fields: formatter(frame, data),
        }));
      })
    ),
};

/**
 * @internal
 */
export const createStringFormatter =
  (fieldMatches: FieldMatcher, formatStringFunction: (field: Field, allFields: Field[]) => string[]) =>
  (frame: DataFrame, allFrames: DataFrame[]) => {
    return frame.fields.map((field) => {
      // Find the configured field
      if (fieldMatches(field, frame, allFrames)) {
        const newVals = formatStringFunction(field, frame.fields);

        return {
          ...field,
          type: FieldType.string,
          values: newVals,
        };
      }

      return field;
    });
  };
