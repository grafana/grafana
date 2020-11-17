import { TransformerRegistyItem } from '@grafana/data';
import { reduceTransformRegistryItem } from '../components/TransformersUI/ReduceTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from '../components/TransformersUI/FilterByNameTransformerEditor';
import { filterFramesByRefIdTransformRegistryItem } from '../components/TransformersUI/FilterByRefIdTransformerEditor';
import { organizeFieldsTransformRegistryItem } from '../components/TransformersUI/OrganizeFieldsTransformerEditor';
import { seriesToFieldsTransformerRegistryItem } from '../components/TransformersUI/SeriesToFieldsTransformerEditor';
import { calculateFieldTransformRegistryItem } from '../components/TransformersUI/CalculateFieldTransformerEditor';
import { labelsToFieldsTransformerRegistryItem } from '../components/TransformersUI/LabelsToFieldsTransformerEditor';
import { groupByTransformRegistryItem } from '../components/TransformersUI/GroupByTransformerEditor';
import { mergeTransformerRegistryItem } from '../components/TransformersUI/MergeTransformerEditor';
import { seriesToRowsTransformerRegistryItem } from '../components/TransformersUI/SeriesToRowsTransformerEditor';
import { concatenateTransformRegistryItem } from '../components/TransformersUI/ConcatenateTransformerEditor';

export const getStandardTransformers = (): Array<TransformerRegistyItem<any>> => {
  return [
    reduceTransformRegistryItem,
    filterFieldsByNameTransformRegistryItem,
    filterFramesByRefIdTransformRegistryItem,
    organizeFieldsTransformRegistryItem,
    seriesToFieldsTransformerRegistryItem,
    seriesToRowsTransformerRegistryItem,
    concatenateTransformRegistryItem,
    calculateFieldTransformRegistryItem,
    labelsToFieldsTransformerRegistryItem,
    groupByTransformRegistryItem,
    mergeTransformerRegistryItem,
  ];
};
