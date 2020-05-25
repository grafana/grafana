import { DataTransformerID } from './ids';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { FieldMatcherID } from '../matchers/ids';
import { FilterOptions, filterFieldsTransformer } from './filter';
import { RegexpOrNamesMatcherOptions } from '../matchers/nameMatcher';

export interface FilterFieldsByNameTransformerOptions {
  include?: RegexpOrNamesMatcherOptions;
  exclude?: RegexpOrNamesMatcherOptions;
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
      include: getMatcherConfig(options.include),
      exclude: getMatcherConfig(options.exclude),
    };

    return filterFieldsTransformer.transformer(filterOptions);
  },
};

const getMatcherConfig = (options?: RegexpOrNamesMatcherOptions): MatcherConfig | undefined => {
  if (!options) {
    return undefined;
  }

  const { names, pattern } = options;

  if ((!Array.isArray(names) || names.length === 0) && !pattern) {
    return undefined;
  }

  if (!pattern) {
    return { id: FieldMatcherID.byNames, options: names };
  }

  if (!Array.isArray(names) || names.length === 0) {
    return { id: FieldMatcherID.byRegexp, options: pattern };
  }

  return { id: FieldMatcherID.byRegexpOrNames, options };
};
