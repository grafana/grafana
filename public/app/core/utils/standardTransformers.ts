import { TransformerRegistryItem } from '@grafana/data';
import { reduceTransformRegistryItem } from '../components/TransformersUI/ReduceTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from '../components/TransformersUI/FilterByNameTransformerEditor';
import { filterFramesByRefIdTransformRegistryItem } from '../components/TransformersUI/FilterByRefIdTransformerEditor';
import { filterByValueTransformRegistryItem } from '../components/TransformersUI/FilterByValueTransformer/FilterByValueTransformerEditor';
import { organizeFieldsTransformRegistryItem } from '../components/TransformersUI/OrganizeFieldsTransformerEditor';
import { seriesToFieldsTransformerRegistryItem } from '../components/TransformersUI/SeriesToFieldsTransformerEditor';
import { calculateFieldTransformRegistryItem } from '../components/TransformersUI/CalculateFieldTransformerEditor';
import { labelsToFieldsTransformerRegistryItem } from '../components/TransformersUI/LabelsToFieldsTransformerEditor';
import { groupByTransformRegistryItem } from '../components/TransformersUI/GroupByTransformerEditor';
import { sortByTransformRegistryItem } from '../components/TransformersUI/SortByTransformerEditor';
import { mergeTransformerRegistryItem } from '../components/TransformersUI/MergeTransformerEditor';
import { seriesToRowsTransformerRegistryItem } from '../components/TransformersUI/SeriesToRowsTransformerEditor';
import { concatenateTransformRegistryItem } from '../components/TransformersUI/ConcatenateTransformerEditor';
import { renameByRegexTransformRegistryItem } from '../components/TransformersUI/RenameByRegexTransformer';
import { histogramTransformRegistryItem } from '../components/TransformersUI/HistogramTransformerEditor';
import { rowsToFieldsTransformRegistryItem } from '../components/TransformersUI/rowsToFields/RowsToFieldsTransformerEditor';
import { configFromQueryTransformRegistryItem } from '../components/TransformersUI/configFromQuery/ConfigFromQueryTransformerEditor';

export const getStandardTransformers = (): Array<TransformerRegistryItem<any>> => {
  return [
    reduceTransformRegistryItem,
    filterFieldsByNameTransformRegistryItem,
    renameByRegexTransformRegistryItem,
    filterFramesByRefIdTransformRegistryItem,
    filterByValueTransformRegistryItem,
    organizeFieldsTransformRegistryItem,
    seriesToFieldsTransformerRegistryItem,
    seriesToRowsTransformerRegistryItem,
    concatenateTransformRegistryItem,
    calculateFieldTransformRegistryItem,
    labelsToFieldsTransformerRegistryItem,
    groupByTransformRegistryItem,
    sortByTransformRegistryItem,
    mergeTransformerRegistryItem,
    histogramTransformRegistryItem,
    rowsToFieldsTransformRegistryItem,
    configFromQueryTransformRegistryItem,
  ];
};
