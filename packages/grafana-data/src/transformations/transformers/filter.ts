import { map } from 'rxjs/operators';

import { DataFrame, Field } from '../../types/dataFrame';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { getFieldMatcher, getFrameMatchers } from '../matchers';

import { DataTransformerID } from './ids';
import { noopTransformer } from './noop';

export interface FilterOptions {
  include?: MatcherConfig;
  exclude?: MatcherConfig;
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
  operator: (options: FilterOptions, ctx) => (source) => {
    if (!options.include && !options.exclude) {
      return source.pipe(noopTransformer.operator({}, ctx));
    }

    if (typeof options.include?.options === 'string') {
      options.include.options = ctx.interpolate(options.include?.options);
    } else if (typeof options.include?.options?.pattern === 'string') {
      options.include.options.pattern = ctx.interpolate(options.include?.options.pattern);
    }

    if (typeof options.exclude?.options === 'string') {
      options.exclude.options = ctx.interpolate(options.exclude?.options);
    } else if (typeof options.exclude?.options?.pattern === 'string') {
      options.exclude.options.pattern = ctx.interpolate(options.exclude?.options.pattern);
    }

    return source.pipe(
      map((data) => {
        const include = options.include ? getFieldMatcher(options.include) : null;
        const exclude = options.exclude ? getFieldMatcher(options.exclude) : null;

        const processed: DataFrame[] = [];
        for (const series of data) {
          // Find the matching field indexes
          const fields: Field[] = [];
          for (let i = 0; i < series.fields.length; i++) {
            const field = series.fields[i];

            if (exclude) {
              if (exclude(field, series, data)) {
                continue;
              }
              if (!include) {
                fields.push(field);
              }
            }
            if (include && include(field, series, data)) {
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
      })
    );
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
  operator: (options, ctx) => (source) => {
    if (!options.include && !options.exclude) {
      return source.pipe(noopTransformer.operator({}, ctx));
    }

    return source.pipe(
      map((data) => {
        const include = options.include ? getFrameMatchers(options.include) : null;
        const exclude = options.exclude ? getFrameMatchers(options.exclude) : null;

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
      })
    );
  },
};
