import { noopTransformer } from './noop';
import { DataFrame, Field } from '../../types/dataFrame';
import { DataTransformerID } from './ids';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { getFieldMatcher, getFrameMatchers } from '../matchers';

export interface FilterOptions {
  hide?: boolean;
  include?: MatcherConfig;
  exclude?: MatcherConfig;
}

export function applyHiddenField(field: Field, hidden?: boolean) {
  return {
    ...field,
    config: {
      ...field.config,
      hidden,
    },
  };
}

export const filterFieldsTransformer: DataTransformerInfo<FilterOptions> = {
  id: DataTransformerID.filterFields,
  name: 'Filter Fields',
  description: 'select a subset of fields',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: FilterOptions) => {
    if (!options.include && !options.exclude) {
      return noopTransformer.transformer({});
    }

    const { hide } = options;
    const include = options.include ? getFieldMatcher(options.include) : null;
    const exclude = options.exclude ? getFieldMatcher(options.exclude) : null;

    return (data: DataFrame[]) => {
      const processed: DataFrame[] = [];
      for (const series of data) {
        // Find the matching field indexes
        const fields: Field[] = [];
        for (let i = 0; i < series.fields.length; i++) {
          let field: Field | null = series.fields[i];

          if (exclude) {
            if (exclude(field, series, data)) {
              if (hide) {
                field = applyHiddenField(field, true);
              } else {
                field = null;
              }
            }
          }
          if (field && include && !include(field, series, data)) {
            if (hide) {
              field = applyHiddenField(field, true);
            } else {
              field = null;
            }
          }

          if (field) {
            fields.push(field);
          }
        }

        if (!fields.length) {
          continue;
        }
        const copy = {
          ...series, // all the other properties
          fields, // but a different set of fields
        };
        processed.push(copy);
      }
      return processed;
    };
  },
};

export const filterFramesTransformer: DataTransformerInfo<FilterOptions> = {
  id: DataTransformerID.filterFrames,
  name: 'Filter Frames',
  description: 'select a subset of frames',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: FilterOptions) => {
    if (!options.include && !options.exclude) {
      return noopTransformer.transformer({});
    }

    const include = options.include ? getFrameMatchers(options.include) : null;
    const exclude = options.exclude ? getFrameMatchers(options.exclude) : null;

    return (data: DataFrame[]) => {
      const processed: DataFrame[] = [];
      for (const series of data) {
        if (exclude) {
          if (exclude(series)) {
            continue;
          }
          if (!include) {
            processed.push(series);
          }
        }
        if (include && include(series)) {
          processed.push(series);
        }
      }
      return processed;
    };
  },
};
