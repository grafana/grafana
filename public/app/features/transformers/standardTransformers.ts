import { TransformerRegistryItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { filterByValueTransformRegistryItem } from './FilterByValueTransformer/FilterByValueTransformerEditor';
import { heatmapTransformRegistryItem } from './calculateHeatmap/HeatmapTransformerEditor';
import { configFromQueryTransformRegistryItem } from './configFromQuery/ConfigFromQueryTransformerEditor';
import { calculateFieldTransformRegistryItem } from './editors/CalculateFieldTransformerEditor';
import { concatenateTransformRegistryItem } from './editors/ConcatenateTransformerEditor';
import { convertFieldTypeTransformRegistryItem } from './editors/ConvertFieldTypeTransformerEditor';
import { filterFieldsByNameTransformRegistryItem } from './editors/FilterByNameTransformerEditor';
import { filterFramesByRefIdTransformRegistryItem } from './editors/FilterByRefIdTransformerEditor';
import { formatStringTransformerRegistryItem } from './editors/FormatStringTransformerEditor';
import { formatTimeTransformerRegistryItem } from './editors/FormatTimeTransformerEditor';
import { groupByTransformRegistryItem } from './editors/GroupByTransformerEditor';
import { groupToNestedTableTransformRegistryItem } from './editors/GroupToNestedTableTransformerEditor';
import { groupingToMatrixTransformRegistryItem } from './editors/GroupingToMatrixTransformerEditor';
import { histogramTransformRegistryItem } from './editors/HistogramTransformerEditor';
import { joinByFieldTransformerRegistryItem } from './editors/JoinByFieldTransformerEditor';
import { labelsToFieldsTransformerRegistryItem } from './editors/LabelsToFieldsTransformerEditor';
import { limitTransformRegistryItem } from './editors/LimitTransformerEditor';
import { mergeTransformerRegistryItem } from './editors/MergeTransformerEditor';
import { organizeFieldsTransformRegistryItem } from './editors/OrganizeFieldsTransformerEditor';
import { reduceTransformRegistryItem } from './editors/ReduceTransformerEditor';
import { renameByRegexTransformRegistryItem } from './editors/RenameByRegexTransformer';
import { seriesToRowsTransformerRegistryItem } from './editors/SeriesToRowsTransformerEditor';
import { sortByTransformRegistryItem } from './editors/SortByTransformerEditor';
import { transposeTransformerRegistryItem } from './editors/TransposeTransformerEditor';
import { extractFieldsTransformRegistryItem } from './extractFields/ExtractFieldsTransformerEditor';
import { joinByLabelsTransformRegistryItem } from './joinByLabels/JoinByLabelsTransformerEditor';
import { fieldLookupTransformRegistryItem } from './lookupGazetteer/FieldLookupTransformerEditor';
import { partitionByValuesTransformRegistryItem } from './partitionByValues/PartitionByValuesEditor';
import { prepareTimeseriesTransformerRegistryItem } from './prepareTimeSeries/PrepareTimeSeriesEditor';
import { regressionTransformerRegistryItem } from './regression/regressionEditor';
import { rowsToFieldsTransformRegistryItem } from './rowsToFields/RowsToFieldsTransformerEditor';
import { spatialTransformRegistryItem } from './spatial/SpatialTransformerEditor';
import { timeSeriesTableTransformRegistryItem } from './timeSeriesTable/TimeSeriesTableTransformEditor';

export const getStandardTransformers = (): TransformerRegistryItem[] => {
  return [
    reduceTransformRegistryItem,
    filterFieldsByNameTransformRegistryItem,
    renameByRegexTransformRegistryItem,
    filterFramesByRefIdTransformRegistryItem,
    filterByValueTransformRegistryItem,
    organizeFieldsTransformRegistryItem,
    joinByFieldTransformerRegistryItem,
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
    limitTransformRegistryItem,
    joinByLabelsTransformRegistryItem,
    partitionByValuesTransformRegistryItem,
    ...(config.featureToggles.formatString ? [formatStringTransformerRegistryItem] : []),
    ...(config.featureToggles.regressionTransformation ? [regressionTransformerRegistryItem] : []),
    ...(config.featureToggles.groupToNestedTableTransformation ? [groupToNestedTableTransformRegistryItem] : []),
    formatTimeTransformerRegistryItem,
    timeSeriesTableTransformRegistryItem,
    transposeTransformerRegistryItem,
  ];
};
