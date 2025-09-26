import { TransformerRegistryItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { getFilterByValueTransformRegistryItem } from './FilterByValueTransformer/FilterByValueTransformerEditor';
import { getHeatmapTransformRegistryItem } from './calculateHeatmap/HeatmapTransformerEditor';
import { getConfigFromQueryTransformRegistryItem } from './configFromQuery/ConfigFromQueryTransformerEditor';
import { getCalculateFieldTransformRegistryItem } from './editors/CalculateFieldTransformerEditor/CalculateFieldTransformerEditor';
import { getConcatenateTransformRegistryItem } from './editors/ConcatenateTransformerEditor';
import { getConvertFieldTypeTransformRegistryItem } from './editors/ConvertFieldTypeTransformerEditor';
import { getConvertFrameTypeTransformRegistryItem } from './editors/ConvertFrameTypeTransformerEditor';
import { getFilterFieldsByNameTransformRegistryItem } from './editors/FilterByNameTransformerEditor';
import { getFilterFramesByRefIdTransformRegistryItem } from './editors/FilterByRefIdTransformerEditor';
import { getFormatStringTransformerRegistryItem } from './editors/FormatStringTransformerEditor';
import { getFormatTimeTransformerRegistryItem } from './editors/FormatTimeTransformerEditor';
import { getGroupByTransformRegistryItem } from './editors/GroupByTransformerEditor';
import { getGroupToNestedTableTransformRegistryItem } from './editors/GroupToNestedTableTransformerEditor';
import { getGroupingToMatrixTransformRegistryItem } from './editors/GroupingToMatrixTransformerEditor';
import { getHistogramTransformRegistryItem } from './editors/HistogramTransformerEditor';
import { getJoinByFieldTransformerRegistryItem } from './editors/JoinByFieldTransformerEditor';
import { getLabelsToFieldsTransformerRegistryItem } from './editors/LabelsToFieldsTransformerEditor';
import { getLimitTransformRegistryItem } from './editors/LimitTransformerEditor';
import { getMergeTransformerRegistryItem } from './editors/MergeTransformerEditor';
import { getOrganizeFieldsTransformRegistryItem } from './editors/OrganizeFieldsTransformerEditor';
import { getReduceTransformRegistryItem } from './editors/ReduceTransformerEditor';
import { getRenameByRegexTransformRegistryItem } from './editors/RenameByRegexTransformer';
import { getSeriesToRowsTransformerRegistryItem } from './editors/SeriesToRowsTransformerEditor';
import { getSortByTransformRegistryItem } from './editors/SortByTransformerEditor';
import { getTransposeTransformerRegistryItem } from './editors/TransposeTransformerEditor';
import { getExtractFieldsTransformRegistryItem } from './extractFields/ExtractFieldsTransformerEditor';
import { getJoinByLabelsTransformRegistryItem } from './joinByLabels/JoinByLabelsTransformerEditor';
import { getFieldLookupTransformRegistryItem } from './lookupGazetteer/FieldLookupTransformerEditor';
import { getPartitionByValuesTransformRegistryItem } from './partitionByValues/PartitionByValuesEditor';
import { getPrepareTimeseriesTransformerRegistryItem } from './prepareTimeSeries/PrepareTimeSeriesEditor';
import { getRegressionTransformerRegistryItem } from './regression/regressionEditor';
import { getRowsToFieldsTransformRegistryItem } from './rowsToFields/RowsToFieldsTransformerEditor';
import { getSpatialTransformRegistryItem } from './spatial/SpatialTransformerEditor';
import { getTimeSeriesTableTransformRegistryItem } from './timeSeriesTable/TimeSeriesTableTransformEditor';

export const getStandardTransformers = (): TransformerRegistryItem[] => {
  return [
    getReduceTransformRegistryItem(),
    getFilterFieldsByNameTransformRegistryItem(),
    getRenameByRegexTransformRegistryItem(),
    getFilterFramesByRefIdTransformRegistryItem(),
    getFilterByValueTransformRegistryItem(),
    getOrganizeFieldsTransformRegistryItem(),
    getJoinByFieldTransformerRegistryItem(),
    getSeriesToRowsTransformerRegistryItem(),
    getConcatenateTransformRegistryItem(),
    getCalculateFieldTransformRegistryItem(),
    getLabelsToFieldsTransformerRegistryItem(),
    getGroupByTransformRegistryItem(),
    getSortByTransformRegistryItem(),
    getMergeTransformerRegistryItem(),
    getHistogramTransformRegistryItem(),
    getRowsToFieldsTransformRegistryItem(),
    getConfigFromQueryTransformRegistryItem(),
    getPrepareTimeseriesTransformerRegistryItem(),
    getConvertFieldTypeTransformRegistryItem(),
    getConvertFrameTypeTransformRegistryItem(),
    getSpatialTransformRegistryItem(),
    getFieldLookupTransformRegistryItem(),
    getExtractFieldsTransformRegistryItem(),
    getHeatmapTransformRegistryItem(),
    getGroupingToMatrixTransformRegistryItem(),
    getLimitTransformRegistryItem(),
    getJoinByLabelsTransformRegistryItem(),
    getRegressionTransformerRegistryItem(),
    getPartitionByValuesTransformRegistryItem(),
    ...(config.featureToggles.formatString ? [getFormatStringTransformerRegistryItem()] : []),
    ...(config.featureToggles.groupToNestedTableTransformation ? [getGroupToNestedTableTransformRegistryItem()] : []),
    getFormatTimeTransformerRegistryItem(),
    getTimeSeriesTableTransformRegistryItem(),
    getTransposeTransformerRegistryItem(),
  ];
};
