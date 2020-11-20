import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { map } from 'rxjs/operators';

export interface RenameByRegexTransformerOptions {
  regex: string;
  renamePattern: string;
}

export const renameByRegexTransformer: DataTransformerInfo<RenameByRegexTransformerOptions> = {
  id: DataTransformerID.renameByRegex,
  name: 'Rename fields by regex',
  description: 'Rename fields based on regular expression by users.',
  defaultOptions: {
    regex: '(.*)',
    renamePattern: '$1',
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: options => source =>
    source.pipe(
      map(data => {
        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        return data.map(frame => {
          const { name } = frame;
          const regex = new RegExp(options.regex);
          if (typeof name === 'string' && name.length !== 0 && regex.test(name)) {
            const newName = name.replace(regex, options.renamePattern);
            return {
              ...frame,
              name: newName,
            };
          }
          return { ...frame };
        });
      })
    ),
};
