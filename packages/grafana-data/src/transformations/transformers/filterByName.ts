import { DataTransformerID } from './ids';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { FieldMatcherID } from '../matchers/ids';
import { FilterOptions, filterFieldsTransformer } from './filter';

export interface FilterFieldsByNameTransformerOptions {
  includeNames?: string[];
  includePattern?: string;
  excludeNames?: string[];
  excludePattern?: string;
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
    const filterOptions: FilterOptions = {
      include: getMatcherConfig(options.includeNames, options.includePattern),
      exclude: getMatcherConfig(options.excludeNames, options.excludePattern),
    };

    return filterFieldsTransformer.transformer(filterOptions);
  },
};

const getMatcherConfig = (names?: string[], pattern?: string): MatcherConfig | undefined => {
  if ((Array.isArray(names) && names.length > 0) || pattern) {
    return { id: FieldMatcherID.byName, options: { names, pattern } };
  }
  return undefined;
};
