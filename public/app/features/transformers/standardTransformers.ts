import { TransformerRegistryItem } from '@grafana/data';
import { reduceTransformRegistryItem } from './editors/ReduceTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from './editors/FilterByNameTransformerEditor';
import { filterFramesByRefIdTransformRegistryItem } from './editors/FilterByRefIdTransformerEditor';
import { filterByValueTransformRegistryItem } from './FilterByValueTransformer/FilterByValueTransformerEditor';
import { organizeFieldsTransformRegistryItem } from './editors/OrganizeFieldsTransformerEditor';
import { seriesToFieldsTransformerRegistryItem } from './editors/SeriesToFieldsTransformerEditor';
import { calculateFieldTransformRegistryItem } from './editors/CalculateFieldTransformerEditor';
import { labelsToFieldsTransformerRegistryItem } from './editors/LabelsToFieldsTransformerEditor';
import { groupByTransformRegistryItem } from './editors/GroupByTransformerEditor';
import { sortByTransformRegistryItem } from './editors/SortByTransformerEditor';
import { mergeTransformerRegistryItem } from './editors/MergeTransformerEditor';
import { seriesToRowsTransformerRegistryItem } from './editors/SeriesToRowsTransformerEditor';
import { concatenateTransformRegistryItem } from './editors/ConcatenateTransformerEditor';
import { renameByRegexTransformRegistryItem } from './editors/RenameByRegexTransformer';
import { histogramTransformRegistryItem } from './editors/HistogramTransformerEditor';
import { rowsToFieldsTransformRegistryItem } from './rowsToFields/RowsToFieldsTransformerEditor';
import { configFromQueryTransformRegistryItem } from './configFromQuery/ConfigFromQueryTransformerEditor';
import { prepareTimeseriesTransformerRegistryItem } from './prepareTimeSeries/PrepareTimeSeriesEditor';
import { convertFieldTypeTransformRegistryItem } from './editors/ConvertFieldTypeTransformerEditor';
import { fieldLookupTransformRegistryItem } from './lookupGazetteer/FieldLookupTransformerEditor';
import { extractFieldsTransformRegistryItem } from './extractFields/ExtractFieldsTransformerEditor';
import { heatmapTransformRegistryItem } from './calculateHeatmap/HeatmapTransformerEditor';
import { spatialTransformRegistryItem } from './spatial/SpatialTransformerEditor';
import { groupingToMatrixTransformRegistryItem } from './editors/GroupingToMatrixTransformerEditor';

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
    prepareTimeseriesTransformerRegistryItem,
    convertFieldTypeTransformRegistryItem,
    spatialTransformRegistryItem,
    fieldLookupTransformRegistryItem,
    extractFieldsTransformRegistryItem,
    heatmapTransformRegistryItem,
    groupingToMatrixTransformRegistryItem,
  ];
};
