import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { stringToJsRegex } from '../../text/string';
import { DataFrame } from '../../types/dataFrame';
import { DataTransformContext, DataTransformerInfo } from '../../types/transformations';

import { DataTransformerID } from './ids';

/**
 * Options for renameByRegexTransformer
 *
 * @public
 */
export interface RenameByRegexTransformerOptions {
  regex: string;
  renamePattern: string;
}

/**
 * Replaces the displayName of a field by applying a regular expression
 * to match the name and a pattern for the replacement.
 *
 * @public
 */
export const renameByRegexTransformer: DataTransformerInfo<RenameByRegexTransformerOptions> = {
  id: DataTransformerID.renameByRegex,
  name: 'Rename fields by regex',
  description: 'Rename fields based on regular expression by users.',
  defaultOptions: {
    regex: '(.*)',
    renamePattern: '$1',
  },

  /**
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options, ctx) => (source) =>
    source.pipe(
      map((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }
        return data.map(renameFieldsByRegex(options, ctx));
      })
    ),
};

const renameFieldsByRegex =
  (options: RenameByRegexTransformerOptions, ctx: DataTransformContext) => (frame: DataFrame) => {
    const regex = stringToJsRegex(options.regex);
    const fields = frame.fields.map((field) => {
      const displayName = getFieldDisplayName(field, frame);
      if (!regex.test(displayName)) {
        return field;
      }
      const renamePattern = ctx.interpolate(options.renamePattern);
      const newDisplayName = displayName.replace(regex, renamePattern);
      return {
        ...field,
        config: { ...field.config, displayName: newDisplayName },
        state: { ...field.state, displayName: newDisplayName },
      };
    });
    return { ...frame, fields };
  };
