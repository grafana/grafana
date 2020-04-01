import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { SortFieldsTransformerOptions, sortFieldsTransformer } from './sort';
import { filterFieldsByNameTransformer } from './filterByName';
import { DataFrame } from '../..';

export interface SortAndFilterFieldsTransformerOptions extends SortFieldsTransformerOptions {
  excludeByName: Record<string, boolean>;
}

export const sortAndFilterFieldsTransformer: DataTransformerInfo<SortAndFilterFieldsTransformerOptions> = {
  id: DataTransformerID.sortAndFilter,
  name: 'Sort fields by name',
  description: 'sort fields based on configuration given by user',
  defaultOptions: {
    excludeByName: {},
    indexByName: {},
  },

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: SortAndFilterFieldsTransformerOptions) => {
    const sort = sortFieldsTransformer.transformer(options);
    const filter = filterFieldsByNameTransformer.transformer({
      exclude: mapToExcludeRegexp(options.excludeByName),
    });

    return (data: DataFrame[]) => sort(filter(data));
  },
};

const mapToExcludeRegexp = (excludeByName: Record<string, boolean>): string | undefined => {
  const fieldsToExclude = Object.keys(excludeByName)
    .filter(name => excludeByName[name])
    .join('|');

  if (fieldsToExclude.length === 0) {
    return undefined;
  }

  return `^(${fieldsToExclude})$`;
};
