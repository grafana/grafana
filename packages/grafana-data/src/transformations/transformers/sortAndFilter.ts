import { DataTransformerID } from './ids';
import { DataTransformerInfo } from '../../types/transformations';
import { SortFieldsTransformerOptions, sortFieldsTransformer } from './sort';
import { FilterFieldsByNameTransformerOptions, filterFieldsByNameTransformer } from './filterByName';
import { DataFrame } from '../..';

export interface SortAndFilterFieldsTransformerOptions
  extends SortFieldsTransformerOptions,
    FilterFieldsByNameTransformerOptions {}

export const sortAndFilterFieldsTransformer: DataTransformerInfo<SortAndFilterFieldsTransformerOptions> = {
  id: DataTransformerID.sortAndFilter,
  name: 'Sort fields by name',
  description: 'sort fields based on configuration given by user',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  transformer: (options: SortAndFilterFieldsTransformerOptions) => {
    const filter = filterFieldsByNameTransformer.transformer(options);
    const sort = sortFieldsTransformer.transformer(options);

    return (data: DataFrame[]) => sort(filter(data));
  },
};
