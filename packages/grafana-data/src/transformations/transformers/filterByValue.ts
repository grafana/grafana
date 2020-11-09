import { map } from 'rxjs/operators';

import { noopTransformer } from './noop';
import { DataTransformerID } from './ids';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { DataFrame, Field } from '../../types/dataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { getValueMatcher } from '../matchers';
import { ArrayVector } from '../../vector/ArrayVector';

export enum FilterByValueMode {
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
  mode: FilterByValueMode;
  match: FilterByValueMatch;
}

export const filterByValueTransformer: DataTransformerInfo<FilterByValueTransformerOptions> = {
  id: DataTransformerID.filterByValue,
  name: 'Filter data by values',
  description: 'select a subset of results based on values',
  defaultOptions: {
    filters: [],
    mode: FilterByValueMode.include,
    match: FilterByValueMatch.any,
  },

  operator: options => source => {
    const filters = options.filters;
    const matchAll = options.match === FilterByValueMatch.all;
    const include = options.mode === FilterByValueMode.include;

    if (!Array.isArray(filters) || filters.length === 0) {
      return source.pipe(noopTransformer.operator({}));
    }

    return source.pipe(
      map(data => {
        if (!Array.isArray(data) || data.length === 0) {
          return data;
        }

        const rows = new Set<number>();

        for (const frame of data) {
          const fieldIndexByName = groupFieldIndexByName(frame, data);

          for (let index = 0; index < frame.length; index++) {
            if (rows.has(index)) {
              continue;
            }

            const checkIfFilterIsMatchingRow = (filter: FilterByValueFilter): boolean => {
              const matcher = getValueMatcher(filter.config);
              const fieldIndex = fieldIndexByName[filter.fieldName] ?? -1;
              if (fieldIndex < 0) {
                return false;
              }
              return matcher(index, frame.fields[fieldIndex], frame, data);
            };

            const matching = matchAll
              ? filters.every(checkIfFilterIsMatchingRow)
              : !!filters.find(checkIfFilterIsMatchingRow);

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

            // TODO: what parts needs to be excluded from field.
            fields.push({
              ...field,
              values: new ArrayVector(buffer),
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

const groupFieldIndexByName = (frame: DataFrame, data: DataFrame[]): Record<string, number> => {
  return frame.fields.reduce((all: Record<string, number>, field, fieldIndex) => {
    const fieldName = getFieldDisplayName(field, frame, data);
    all[fieldName] = fieldIndex;
    return all;
  }, {});
};
