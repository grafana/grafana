import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { FieldMatcherOptions } from '../matchers/fieldValuesMatcher';
import { FieldMatcherID } from '../matchers/ids';

import { filterFieldsTransformer } from './filter';
import { DataTransformerID } from './ids';

export interface FilterFieldsByValuesTransformerOptions {
  include?: FieldMatcherOptions;
  exclude?: FieldMatcherOptions;
}

export const filterFieldsByValuesTransformer: DataTransformerInfo<FilterFieldsByValuesTransformerOptions> = {
  id: DataTransformerID.filterFieldsByValue,
  name: 'Filter fields by values',
  description: 'select a subset of fields',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
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

const getMatcherConfig = (options?: FieldMatcherOptions): MatcherConfig | undefined => {
  if (!options) {
    return undefined;
  }

  if (!options.valueMatcherConfig) {
    return undefined;
  }

  return { id: FieldMatcherID.allValues, options };
};
