import { DataTransformerID } from './ids';
import { DataFrame, Field } from '../../types/dataFrame';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { getFieldDisplayName } from '../../field/fieldState';
import { ArrayVector } from '../../vector/ArrayVector';
import { getValueMatcher } from '../matchers';

export interface ValueFilter {
  fieldName: string;
  config: MatcherConfig;
}

export interface FilterByValueTransformerOptions {
  filters: ValueFilter[];
  // TODO: create enum that holds this value.
  type: string; // 'include' or 'exclude'
  // TODO: create enum that holds this value.
  match: string; // 'all' or 'any'
}

export const filterByValueTransformer: DataTransformerInfo<FilterByValueTransformerOptions> = {
  id: DataTransformerID.filterByValue,
  name: 'Filter by value',
  description: 'Filter the data points (rows) depending on the value of certain fields',
  defaultOptions: {
    valueFilters: [],
    type: 'include',
    match: 'any',
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: FilterByValueTransformerOptions) => {
    const includeRow = options.type === 'include';
    const matchAll = options.match === 'all';

    return (data: DataFrame[]) => {
      if (options.filters.length === 0) {
        return data;
      }

      const { filters: valueFilters } = options;
      const matchingRows = new Set<number>();

      for (const frame of data) {
        const fieldIndexByName = groupFieldIndexByName(frame, data);

        for (let index = 0; index < frame.length; index++) {
          if (matchingRows.has(index)) {
            // Row already matching filters no need to check again.
            continue;
          }

          const checkIfFilterIsMatchingRow = (filter: ValueFilter): boolean => {
            const matcher = getValueMatcher(filter.config);
            const fieldIndex = fieldIndexByName[filter.fieldName];
            return matcher(index, frame.fields[fieldIndex], frame, data);
          };

          const matching = matchAll
            ? valueFilters.every(checkIfFilterIsMatchingRow)
            : !!valueFilters.find(checkIfFilterIsMatchingRow);

          if (matching) {
            matchingRows.add(index);
          }
        }
      }

      const processed: DataFrame[] = [];

      for (let frame of data) {
        const fields: Field[] = [];

        for (const field of frame.fields) {
          const buffer = [];

          for (let index = 0; index < frame.length; index++) {
            if (includeRow && matchingRows.has(index)) {
              buffer.push(field.values.get(index));
              continue;
            }

            if (!includeRow && !matchingRows.has(index)) {
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

        // TODO: calculate frame length.
        processed.push({
          ...frame,
          fields: fields,
        });
      }

      return processed;
    };
  },
};

const groupFieldIndexByName = (frame: DataFrame, data: DataFrame[]): Record<string, number> => {
  return frame.fields.reduce((all: Record<string, number>, field, fieldIndex) => {
    const fieldName = getFieldDisplayName(field, frame, data);
    all[fieldName] = fieldIndex;
    return all;
  }, {});
};
