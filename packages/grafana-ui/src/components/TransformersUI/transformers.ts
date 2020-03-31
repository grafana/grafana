import { Registry } from '@grafana/data';
import { reduceTransformRegistryItem } from './ReduceTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from './FilterByNameTransformerEditor';
import { filterFramesByRefIdTransformRegistryItem } from './FilterByRefIdTransformerEditor';
import { TransformerUIRegistyItem } from './types';
import { sortAndFilterTransformRegistryItem } from './SortAndFilterTransformerEditor';

export const transformersUIRegistry = new Registry<TransformerUIRegistyItem<any>>(() => {
  return [
    reduceTransformRegistryItem,
    filterFieldsByNameTransformRegistryItem,
    filterFramesByRefIdTransformRegistryItem,
    sortAndFilterTransformRegistryItem,
  ];
});
