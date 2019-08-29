import { Registry, RegistryItem } from '@grafana/data';
import { reduceTransformRegistryItem } from './ReduceTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from './FilterByNameTransformerEditor';

interface TransformerUIRegistyItem extends RegistryItem {
  component: React.ComponentType<any>;
}

export const transformersUIRegistry = new Registry<TransformerUIRegistyItem>(() => {
  return [reduceTransformRegistryItem, filterFieldsByNameTransformRegistryItem];
});
