import { TransformerRegistryItem } from '@grafana/data';
import { reduceTransformRegistryItem } from '../components/TransformersUI/ReduceTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from '../components/TransformersUI/FilterByNameTransformerEditor';
import { filterFramesByRefIdTransformRegistryItem } from '../components/TransformersUI/FilterByRefIdTransformerEditor';
import { organizeFieldsTransformRegistryItem } from '../components/TransformersUI/OrganizeFieldsTransformerEditor';
import { seriesToFieldsTransformerRegistryItem } from '../components/TransformersUI/SeriesToFieldsTransformerEditor';
import { calculateFieldTransformRegistryItem } from '../components/TransformersUI/CalculateFieldTransformerEditor';
import { labelsToFieldsTransformerRegistryItem } from '../components/TransformersUI/LabelsToFieldsTransformerEditor';

export const getStandardTransformers = (): Array<TransformerRegistryItem<any>> => {
  return [
    reduceTransformRegistryItem,
    filterFieldsByNameTransformRegistryItem,
    filterFramesByRefIdTransformRegistryItem,
    organizeFieldsTransformRegistryItem,
    seriesToFieldsTransformerRegistryItem,
    calculateFieldTransformRegistryItem,
    labelsToFieldsTransformerRegistryItem,
  ];
};
