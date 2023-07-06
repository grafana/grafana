import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { FieldMatcherID } from '../matchers/ids';
import { RegexpOrNamesMatcherOptions } from '../matchers/nameMatcher';

import { filterFieldsTransformer } from './filter';
import { DataTransformerID } from './ids';

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
   * Return a modified copy of the series. If the transform is not or should not
   * be applied, just return the input series
   */
  operator: (options, replace) => (source) =>
    source.pipe(
      filterFieldsTransformer.operator(
        {
          include: getMatcherConfig(options.include),
          exclude: getMatcherConfig(options.exclude),
        },
        replace
      )
    ),
};

// Exported to share with other implementations, but not exported to `@grafana/data`
export const getMatcherConfig = (options?: RegexpOrNamesMatcherOptions): MatcherConfig | undefined => {
  if (!options) {
    return undefined;
  }

  const { names, pattern } = options;

  if ((!Array.isArray(names) || names.length === 0) && !pattern) {
    return undefined;
  }

  if (!pattern) {
    return { id: FieldMatcherID.byNames, options: { names } };
  }

  if (!Array.isArray(names) || names.length === 0) {
    return { id: FieldMatcherID.byRegexp, options: pattern };
  }

  return { id: FieldMatcherID.byRegexpOrNames, options };
};
