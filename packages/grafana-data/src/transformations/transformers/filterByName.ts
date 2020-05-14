import { DataTransformerID } from './ids';
import { DataTransformerInfo, MatcherConfig } from '../../types/transformations';
import { FieldMatcherID } from '../matchers/ids';
import { FilterOptions, filterFieldsTransformer } from './filter';

export interface FilterFieldsByNameTransformerOptions {
  include?: string[];
  exclude?: string[];
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

const getMatcherConfig = (patterns?: string[]): MatcherConfig | undefined => {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return undefined;
  }

  const pattern = buildRegex(patterns);

  return {
    id: FieldMatcherID.byName,
    options: { pattern },
  };
};

const buildRegex = (regexs: string[]) => {
  const include = regexs.map(s => `(${s})`).join('|');
  return `/${include}/`;
};
