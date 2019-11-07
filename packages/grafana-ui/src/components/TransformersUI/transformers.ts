import { Registry } from '@grafana/data';
import { reduceTransformRegistryItem } from './ReduceTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from './FilterByNameTransformerEditor';
import { TransformerUIRegistyItem } from './types';

export const transformersUIRegistry = new Registry<TransformerUIRegistyItem<any>>(() => {
  return [reduceTransformRegistryItem, filterFieldsByNameTransformRegistryItem];
});
