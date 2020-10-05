import { DataTransformerID } from './ids';
import { filterFramesTransformer, FilterOptions } from './filter';
import { DataTransformerInfo } from '../../types/transformations';
import { FrameMatcherID } from '../matchers/ids';

export interface FilterFramesByRefIdTransformerOptions {
  include?: string;
  exclude?: string;
}

export const filterFramesByRefIdTransformer: DataTransformerInfo<FilterFramesByRefIdTransformerOptions> = {
  id: DataTransformerID.filterByRefId,
  name: 'Filter data by query refId',
  description: 'select a subset of results',
  defaultOptions: {},

  /**
   * Return a modified copy of the series.  If the transform is not or should not
   * be applied, just return the input series
   */
  operator: options => source => {
    const filterOptions: FilterOptions = {};
    if (options.include) {
      filterOptions.include = {
        id: FrameMatcherID.byRefId,
        options: options.include,
      };
    }
    if (options.exclude) {
      filterOptions.exclude = {
        id: FrameMatcherID.byRefId,
        options: options.exclude,
      };
    }

    return source.pipe(filterFramesTransformer.operator(filterOptions));
  },
};
