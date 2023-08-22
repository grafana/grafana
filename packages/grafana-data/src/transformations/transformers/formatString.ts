import { map } from 'rxjs/operators';

import { Field, FieldType } from '../../types';
import { DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

export enum FormatStringOutput {
  UpperCase = 'Upper Case',
  LowerCase = 'Lower Case',
  FirstLetter = 'Capitalize First Letter',
  EveryFirstLetter = 'Capitalize First Letter Of Every Word',
  PascalCase = 'PascalCase',
  CamelCase = 'camelCase',
}

export interface FormatStringTransformerOptions {
  stringField: string;
  outputFormat: string;
}

export const formatStringTransformer: DataTransformerInfo<FormatStringTransformerOptions> = {
  id: DataTransformerID.formatString,
  name: 'Format string',
  description: 'Set the capitalisation of a string field',
  defaultOptions: { stringField: '', outputFormat: '' },
  operator: (options) => (source) =>
    source.pipe(
      map((data) => {
        const formatter = createStringFormatter(options.stringField, options.outputFormat);

        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        return data.map((frame) => ({
          ...frame,
          fields: formatter(frame.fields),
        }));
      })
    ),
};

/**
 * @internal
 */
export const createStringFormatter = (stringField: string, outputFormat: string) => (fields: Field[]) => {
  return fields.map((field) => {
    // Find the configured field
    if (field.name === stringField) {
      // Update values to use the configured format
      const newVals = field.values.map((value: String) => {
        switch (outputFormat) {
          case FormatStringOutput.UpperCase:
            return value.toUpperCase();
          case FormatStringOutput.LowerCase:
            return value.toLowerCase();
          case FormatStringOutput.FirstLetter:
            return value.charAt(0).toUpperCase() + value.slice(1);
          case FormatStringOutput.EveryFirstLetter:
            const arr = value.split(' ');
            for (var i = 0; i < arr.length; i++) {
              arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);
            }
            return arr.join(' ');
          case FormatStringOutput.PascalCase:
            const arrPascal = value.split(' ');
            for (var i = 0; i < arrPascal.length; i++) {
              arrPascal[i] = arrPascal[i].charAt(0).toUpperCase() + arrPascal[i].slice(1).toLowerCase();
            }
            return arrPascal.join('');
          case FormatStringOutput.CamelCase:
            const arrCamel = value.split(' ');
            for (var i = 0; i < arrCamel.length; i++) {
              arrCamel[i] = arrCamel[i].charAt(0).toUpperCase() + arrCamel[i].slice(1).toLowerCase();
            }
            value = arrCamel.join('');
            return value.charAt(0).toLowerCase() + value.slice(1);
        }
        return value;
      });

      return {
        ...field,
        type: FieldType.string,
        values: newVals,
      };
    }

    return field;
  });
};
