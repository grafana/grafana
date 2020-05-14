import { DataTransformerID } from './ids';
import { DataTransformerInfo, FieldMatcher } from '../../types/transformations';
import { FieldMatcherID } from '../matchers/ids';
import { noopTransformer } from './noop';
import { getFieldMatcher } from '../matchers';
import { DataFrame, Field } from '../../types/dataFrame';

export interface FilterFieldsByNameTransformerOptions {
  include?: string[];
  exclude?: string[];
}

export const filterFieldsByNameTransformer: DataTransformerInfo<FilterFieldsByNameTransformerOptions> = {
  id: DataTransformerID.filterFieldsByName,
  name: 'Filter fields by name',
  description: 'select a subset of fields',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: FilterFieldsByNameTransformerOptions) => {
    if (!options.include && !options.exclude) {
      return noopTransformer.transformer({});
    }

    return (series: DataFrame[]) => {
      const processed: DataFrame[] = [];
      for (const frame of series) {
        // Find the matching field indexes
        const fields: Field[] = [];
        for (let i = 0; i < frame.fields.length; i++) {
          const field = frame.fields[i];
          const include = getFieldNameMatcher(options.include, frame, series);
          const exclude = getFieldNameMatcher(options.exclude, frame, series);

          if (exclude) {
            if (exclude(field)) {
              continue;
            }
            if (!include) {
              fields.push(field);
            }
          }
          if (include && include(field)) {
            fields.push(field);
          }
        }

        if (!fields.length) {
          continue;
        }
        const copy = {
          ...frame, // all the other properties
          fields, // but a different set of fields
        };
        processed.push(copy);
      }
      return processed;
    };
  },
};

const getFieldNameMatcher = (patterns?: string[], frame?: DataFrame, series?: DataFrame[]): FieldMatcher | null => {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return null;
  }

  const pattern = buildRegex(patterns);

  return getFieldMatcher({
    id: FieldMatcherID.byName,
    options: { pattern, frame, series },
  });
};

const buildRegex = (regexs: string[]) => {
  const include = regexs.map(s => `(${s})`).join('|');
  return `/${include}/`;
};
