import { Registry } from '@grafana/data';
import { reduceTransformRegistryItem } from './ReduceTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from './FilterByNameTransformerEditor';
import { TransformerUIRegistyItem } from './types';

export const transformersUIRegistry = new Registry<TransformerUIRegistyItem>(() => {
  return [reduceTransformRegistryItem, filterFieldsByNameTransformRegistryItem];
});
