import { TransformerRegistyItem } from '@grafana/data';
import { reduceTransformRegistryItem } from '../components/TransformersUI/ReduceTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from '../components/TransformersUI/FilterByNameTransformerEditor';
import { filterFramesByRefIdTransformRegistryItem } from '../components/TransformersUI/FilterByRefIdTransformerEditor';
import { organizeFieldsTransformRegistryItem } from '../components/TransformersUI/OrganizeFieldsTransformerEditor';
import { seriesToFieldsTransformerRegistryItem } from '../components/TransformersUI/SeriesToFieldsTransformerEditor';
import { reduceByRowTransformRegistryItem } from '../components/TransformersUI/ReduceByRowTransformerEditor';

export const getStandardTransformers = (): Array<TransformerRegistyItem<any>> => {
  return [
    reduceTransformRegistryItem,
    filterFieldsByNameTransformRegistryItem,
    filterFramesByRefIdTransformRegistryItem,
    organizeFieldsTransformRegistryItem,
    seriesToFieldsTransformerRegistryItem,
    reduceByRowTransformRegistryItem,
  ];
};
