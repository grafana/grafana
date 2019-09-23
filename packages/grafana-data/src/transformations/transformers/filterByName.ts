import { DataTransformerID } from './ids';
import { filterFieldsTransformer, FilterOptions } from './filter';
import { DataTransformerInfo } from '../../types/transformations';
import { FieldMatcherID } from '../matchers/ids';

export interface FilterFieldsByNameTransformerOptions {
  include?: string;
  exclude?: string;
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
    const filterOptions: FilterOptions = {};
    if (options.include) {
      filterOptions.include = {
        id: FieldMatcherID.byName,
        options: options.include,
      };
    }
    if (options.exclude) {
      filterOptions.exclude = {
        id: FieldMatcherID.byName,
        options: options.exclude,
      };
    }

    return filterFieldsTransformer.transformer(filterOptions);
  },
};
