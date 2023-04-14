import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../../field/fieldState';
import { DataFrame, Field } from '../../types/dataFrame';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { getValueMatcher } from '../matchers';

import { DataTransformerID } from './ids';
import { noopTransformer } from './noop';

export enum FilterByValueType {
  exclude = 'exclude',
  include = 'include',
}

export enum FilterByValueMatch {
  all = 'all',
  any = 'any',
}

export interface FilterByValueFilter {
  fieldName: string;
  config: MatcherConfig;
}

export interface FilterByValueTransformerOptions {
  filters: FilterByValueFilter[];
  type: FilterByValueType;
  match: FilterByValueMatch;
}

export const filterByValueTransformer: DataTransformerInfo<FilterByValueTransformerOptions> = {
  id: DataTransformerID.filterByValue,
  name: 'Filter data by values',
  description: 'select a subset of results based on values',
  defaultOptions: {
    filters: [],
    type: FilterByValueType.include,
    match: FilterByValueMatch.any,
  },

  operator: (options, ctx) => (source) => {
    const filters = options.filters;
    const matchAll = options.match === FilterByValueMatch.all;
    const include = options.type === FilterByValueType.include;

    if (!Array.isArray(filters) || filters.length === 0) {
      return source.pipe(noopTransformer.operator({}, ctx));
    }

    return source.pipe(
      map((data) => {
        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        const rows = new Set<number>();

        for (const frame of data) {
          const fieldIndexByName = groupFieldIndexByName(frame, data);
          const matchers = createFilterValueMatchers(filters, fieldIndexByName);

          for (let index = 0; index < frame.length; index++) {
            if (rows.has(index)) {
              continue;
            }

            let matching = true;

            for (const matcher of matchers) {
              const match = matcher(index, frame, data);

              if (!matchAll && match) {
                matching = true;
                break;
              }

              if (matchAll && !match) {
                matching = false;
                break;
              }

              matching = match;
            }

            if (matching) {
              rows.add(index);
            }
          }
        }

        const processed: DataFrame[] = [];
        const frameLength = include ? rows.size : data[0].length - rows.size;

        for (const frame of data) {
          const fields: Field[] = [];

          for (const field of frame.fields) {
            const buffer = [];

            for (let index = 0; index < frame.length; index++) {
              if (include && rows.has(index)) {
                buffer.push(field.values.get(index));
                continue;
              }

              if (!include && !rows.has(index)) {
                buffer.push(field.values.get(index));
                continue;
              }
            }

            // We keep field config, but clean the state as it's being recalculated when the field overrides are applied
            fields.push({
              ...field,
              values: buffer,
              state: {},
            });
          }

          processed.push({
            ...frame,
            fields: fields,
            length: frameLength,
          });
        }

        return processed;
      })
    );
  },
};

const createFilterValueMatchers = (
  filters: FilterByValueFilter[],
  fieldIndexByName: Record<string, number>
): Array<(index: number, frame: DataFrame, data: DataFrame[]) => boolean> => {
  const noop = () => false;

  return filters.map((filter) => {
    const fieldIndex = fieldIndexByName[filter.fieldName] ?? -1;

    if (fieldIndex < 0) {
      console.warn(`[FilterByValue] Could not find index for field name: ${filter.fieldName}`);
      return noop;
    }

    const matcher = getValueMatcher(filter.config);
    return (index, frame, data) => matcher(index, frame.fields[fieldIndex], frame, data);
  });
};

const groupFieldIndexByName = (frame: DataFrame, data: DataFrame[]): Record<string, number> => {
  return frame.fields.reduce((all: Record<string, number>, field, fieldIndex) => {
    const fieldName = getFieldDisplayName(field, frame, data);
    all[fieldName] = fieldIndex;
    return all;
  }, {});
};
