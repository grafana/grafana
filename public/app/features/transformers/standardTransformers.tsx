import { lazy } from 'react';

import { DataTransformerID, PluginState, TransformerCategory, type TransformerRegistryItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

// Direct source import - standardTransformers was removed from @grafana/data's public API
// to keep it out of the plugin-facing shared chunk.
import { standardTransformers } from '../../../../packages/grafana-data/src/transformations/transformers';

import { isHeatmapApplicable } from './calculateHeatmap/applicability';
// SVG images - dark
import calculateFieldDark from './images/dark/calculateField.svg';
import concatenateDark from './images/dark/concatenate.svg';
import configFromDataDark from './images/dark/configFromData.svg';
import convertFieldTypeDark from './images/dark/convertFieldType.svg';
import extractFieldsDark from './images/dark/extractFields.svg';
import fieldLookupDark from './images/dark/fieldLookup.svg';
import filterByRefIdDark from './images/dark/filterByRefId.svg';
import filterByValueDark from './images/dark/filterByValue.svg';
import filterFieldsByNameDark from './images/dark/filterFieldsByName.svg';
import formatStringDark from './images/dark/formatString.svg';
import formatTimeDark from './images/dark/formatTime.svg';
import groupByDark from './images/dark/groupBy.svg';
import groupToNestedTableDark from './images/dark/groupToNestedTable.svg';
import groupingToMatrixDark from './images/dark/groupingToMatrix.svg';
import heatmapDark from './images/dark/heatmap.svg';
import histogramDark from './images/dark/histogram.svg';
import joinByFieldDark from './images/dark/joinByField.svg';
import joinByLabelsDark from './images/dark/joinByLabels.svg';
import labelsToFieldsDark from './images/dark/labelsToFields.svg';
import limitDark from './images/dark/limit.svg';
import mergeDark from './images/dark/merge.svg';
import organizeDark from './images/dark/organize.svg';
import partitionByValuesDark from './images/dark/partitionByValues.svg';
import prepareTimeSeriesDark from './images/dark/prepareTimeSeries.svg';
import reduceDark from './images/dark/reduce.svg';
import regressionDark from './images/dark/regression.svg';
import renameByRegexDark from './images/dark/renameByRegex.svg';
import rowsToFieldsDark from './images/dark/rowsToFields.svg';
import seriesToRowsDark from './images/dark/seriesToRows.svg';
import smoothingDark from './images/dark/smoothing.svg';
import sortByDark from './images/dark/sortBy.svg';
import spatialDark from './images/dark/spatial.svg';
import timeSeriesTableDark from './images/dark/timeSeriesTable.svg';
import transposeDark from './images/dark/transpose.svg';
// SVG images - light
import calculateFieldLight from './images/light/calculateField.svg';
import concatenateLight from './images/light/concatenate.svg';
import configFromDataLight from './images/light/configFromData.svg';
import convertFieldTypeLight from './images/light/convertFieldType.svg';
import extractFieldsLight from './images/light/extractFields.svg';
import fieldLookupLight from './images/light/fieldLookup.svg';
import filterByRefIdLight from './images/light/filterByRefId.svg';
import filterByValueLight from './images/light/filterByValue.svg';
import filterFieldsByNameLight from './images/light/filterFieldsByName.svg';
import formatStringLight from './images/light/formatString.svg';
import formatTimeLight from './images/light/formatTime.svg';
import groupByLight from './images/light/groupBy.svg';
import groupToNestedTableLight from './images/light/groupToNestedTable.svg';
import groupingToMatrixLight from './images/light/groupingToMatrix.svg';
import heatmapLight from './images/light/heatmap.svg';
import histogramLight from './images/light/histogram.svg';
import joinByFieldLight from './images/light/joinByField.svg';
import joinByLabelsLight from './images/light/joinByLabels.svg';
import labelsToFieldsLight from './images/light/labelsToFields.svg';
import limitLight from './images/light/limit.svg';
import mergeLight from './images/light/merge.svg';
import organizeLight from './images/light/organize.svg';
import partitionByValuesLight from './images/light/partitionByValues.svg';
import prepareTimeSeriesLight from './images/light/prepareTimeSeries.svg';
import reduceLight from './images/light/reduce.svg';
import regressionLight from './images/light/regression.svg';
import renameByRegexLight from './images/light/renameByRegex.svg';
import rowsToFieldsLight from './images/light/rowsToFields.svg';
import seriesToRowsLight from './images/light/seriesToRows.svg';
import smoothingLight from './images/light/smoothing.svg';
import sortByLight from './images/light/sortBy.svg';
import spatialLight from './images/light/spatial.svg';
import timeSeriesTableLight from './images/light/timeSeriesTable.svg';
import transposeLight from './images/light/transpose.svg';
import { isSmoothingApplicable } from './smoothing/applicability';
import { isTimeSeriesTableApplicable } from './timeSeriesTable/applicability';

const emptyLazyEditor = lazy(async () => ({ default: () => <></> }));

function hiddenTransformer(
  id: DataTransformerID,
  transformation: TransformerRegistryItem['transformation']
): TransformerRegistryItem {
  return {
    id,
    transformation,
    editor: emptyLazyEditor,
    name: id,
    description: '',
    imageDark: '',
    imageLight: '',
    excludeFromPicker: true,
  };
}

export const getStandardTransformers = (): TransformerRegistryItem[] => {
  return [
    {
      id: DataTransformerID.reduce,
      editor: lazy(() =>
        import('./editors/ReduceTransformerEditor').then((m) => ({ default: m.ReduceTransformerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.reduceTransformer),
      name: t('transformers.reduce-transformer-editor.name.reduce', 'Reduce'),
      description: t(
        'transformers.reduce-transformer-editor.description.reduce-to-single-value',
        'Reduce all rows or data points to a single value (ex. max, mean).'
      ),
      categories: new Set([TransformerCategory.CalculateNewFields]),
      imageDark: reduceDark,
      imageLight: reduceLight,
    },
    {
      id: DataTransformerID.filterFieldsByName,
      editor: lazy(() =>
        import('./editors/FilterByNameTransformerEditor').then((m) => ({
          default: m.FilterByNameTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.filterFieldsByNameTransformer),
      name: t('transformers.filter-by-name-transformer-editor.name.filter-fields-by-name', 'Filter fields by name'),
      description: t(
        'transformers.filter-by-name-transformer-editor.description.remove-part-query-results-regex-pattern',
        'Remove parts of the query results using a regex pattern.'
      ),
      categories: new Set([TransformerCategory.Filter]),
      imageDark: filterFieldsByNameDark,
      imageLight: filterFieldsByNameLight,
    },
    {
      id: DataTransformerID.renameByRegex,
      editor: lazy(() =>
        import('./editors/RenameByRegexTransformer').then((m) => ({ default: m.RenameByRegexTransformerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.renameByRegexTransformer),
      name: t('transformers.rename-by-regex-transformer.name.rename-fields-by-regex', 'Rename fields by regex'),
      description: t(
        'transformers.rename-by-regex-transformer.description.rename-parts-using-regex',
        'Rename parts of the query results using a regular expression and replacement pattern.'
      ),
      categories: new Set([TransformerCategory.ReorderAndRename]),
      imageDark: renameByRegexDark,
      imageLight: renameByRegexLight,
    },
    {
      id: DataTransformerID.filterByRefId,
      editor: lazy(() =>
        import('./editors/FilterByRefIdTransformerEditor').then((m) => ({ default: m.FilterByRefIdTransformerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.filterFramesByRefIdTransformer),
      name: t('transformers.filter-by-ref-id-transformer-editor.name.filter-data-by-query', 'Filter data by query'),
      description: t(
        'transformers.filter-by-ref-id-transformer-editor.description.filter-data-by-query-useful-sharing-results',
        'Remove rows from the data based on origin query'
      ),
      categories: new Set([TransformerCategory.Filter]),
      imageDark: filterByRefIdDark,
      imageLight: filterByRefIdLight,
    },
    {
      id: DataTransformerID.filterByValue,
      editor: lazy(() =>
        import('./FilterByValueTransformer/FilterByValueTransformerEditor').then((m) => ({
          default: m.FilterByValueTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.filterByValueTransformer),
      name: t('transformers.filter-by-value-transformer-editor.name.filter-data-by-values', 'Filter data by values'),
      description: t(
        'transformers.filter-by-value-transformer-editor.description.remove-rows-query-results-user-defined-filters',
        'Remove rows from the query results using user-defined filters.'
      ),
      categories: new Set([TransformerCategory.Filter]),
      imageDark: filterByValueDark,
      imageLight: filterByValueLight,
    },
    {
      id: DataTransformerID.organize,
      editor: lazy(() =>
        import('./editors/OrganizeFieldsTransformerEditor').then((m) => ({
          default: m.OrganizeFieldsTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.organizeFieldsTransformer),
      defaultOptions: standardTransformers.organizeFieldsTransformer.defaultOptions,
      name: t('transformers.organize-fields-transformer-editor.name.organize-fields', 'Organize fields by name'),
      description: t(
        'transformers.organize-fields-transformer-editor.description.reorder-hide-or-rename-fields',
        'Re-order, hide, or rename fields.'
      ),
      categories: new Set([TransformerCategory.ReorderAndRename]),
      imageDark: organizeDark,
      imageLight: organizeLight,
    },
    {
      id: DataTransformerID.joinByField,
      aliasIds: [DataTransformerID.seriesToColumns],
      editor: lazy(() =>
        import('./editors/JoinByFieldTransformerEditor').then((m) => ({
          default: m.SeriesToFieldsTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.joinByFieldTransformer),
      name: t('transformers.join-by-field-transformer-editor.name.join-by-field', 'Join by field'),
      description: t(
        'transformers.join-by-field-transformer-editor.description.combine-rows-from-2-tables',
        'Combine rows from 2+ tables, based on a related field.'
      ),
      categories: new Set([TransformerCategory.Combine]),
      imageDark: joinByFieldDark,
      imageLight: joinByFieldLight,
    },
    {
      id: DataTransformerID.seriesToRows,
      editor: lazy(() =>
        import('./editors/SeriesToRowsTransformerEditor').then((m) => ({
          default: m.SeriesToRowsTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.seriesToRowsTransformer),
      name: t('transformers.series-to-rows-transformer-editor.name.series-to-rows', 'Series to rows'),
      description: t(
        'transformers.series-to-rows-transformer-editor.description.merge-multiple-series',
        'Merge multiple series. Return time, metric and values as a row.'
      ),
      categories: new Set([TransformerCategory.Combine, TransformerCategory.Reformat]),
      imageDark: seriesToRowsDark,
      imageLight: seriesToRowsLight,
    },
    {
      id: DataTransformerID.concatenate,
      editor: lazy(() =>
        import('./editors/ConcatenateTransformerEditor').then((m) => ({
          default: m.ConcatenateTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.concatenateTransformer),
      name: t('transformers.editors.concatenate-transformer-editor.name.concatenate-fields', 'Concatenate fields'),
      description: t(
        'transformers.editors.concatenate-transformer-editor.description.combine-all-fields',
        'Combine all fields into a single frame.'
      ),
      categories: new Set([TransformerCategory.Combine]),
      tags: new Set([t('transformers.editors.concatenate-transformer-editor.tags.combine', 'Combine')]),
      imageDark: concatenateDark,
      imageLight: concatenateLight,
    },
    {
      id: DataTransformerID.calculateField,
      editor: lazy(() =>
        import('./editors/CalculateFieldTransformerEditor/CalculateFieldTransformerEditor').then((m) => ({
          default: m.CalculateFieldTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.calculateFieldTransformer),
      defaultOptions: standardTransformers.calculateFieldTransformer.defaultOptions,
      name: t(
        'transformers.get-calculate-field-transform-registry-item.name.add-field-from-calculation',
        'Add field from calculation'
      ),
      description: t(
        'transformers.get-calculate-field-transform-registry-item.description.values-calculate-field',
        'Use the row values to calculate a new field.'
      ),
      categories: new Set([TransformerCategory.CalculateNewFields]),
      imageDark: calculateFieldDark,
      imageLight: calculateFieldLight,
    },
    {
      id: DataTransformerID.labelsToFields,
      editor: lazy(() =>
        import('./editors/LabelsToFieldsTransformerEditor').then((m) => ({
          default: m.LabelsAsFieldsTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.labelsToFieldsTransformer),
      name: t('transformers.labels-to-fields-transformer-editor.name.labels-to-fields', 'Labels to fields'),
      description: t(
        'transformers.labels-to-fields-transformer-editor.description.groups-series-time-return-labels-tags-fields',
        'Group series by time and return labels or tags as fields.'
      ),
      categories: new Set([TransformerCategory.Reformat]),
      imageDark: labelsToFieldsDark,
      imageLight: labelsToFieldsLight,
    },
    {
      id: DataTransformerID.groupBy,
      editor: lazy(() =>
        import('./editors/GroupByTransformerEditor').then((m) => ({ default: m.GroupByTransformerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.groupByTransformer),
      defaultOptions: standardTransformers.groupByTransformer.defaultOptions,
      isApplicable: standardTransformers.groupByTransformer.isApplicable,
      isApplicableDescription: standardTransformers.groupByTransformer.isApplicableDescription,
      name: t('transformers.group-by-transformer-editor.name.group-by', 'Group by'),
      description: t(
        'transformers.group-by-transformer-editor.description.group-series-by-field-calculate-stats',
        'Group data by a field value and create aggregate data.'
      ),
      categories: new Set([
        TransformerCategory.Combine,
        TransformerCategory.CalculateNewFields,
        TransformerCategory.Reformat,
      ]),
      imageDark: groupByDark,
      imageLight: groupByLight,
    },
    {
      id: DataTransformerID.sortBy,
      editor: lazy(() =>
        import('./editors/SortByTransformerEditor').then((m) => ({ default: m.SortByTransformerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.sortByTransformer),
      name: t('transformers.sort-by-transformer-editor.name.sort-by', 'Sort by'),
      description: t('transformers.sort-by-transformer-editor.description.sort-fields', 'Sort fields in a frame.'),
      categories: new Set([TransformerCategory.ReorderAndRename]),
      imageDark: sortByDark,
      imageLight: sortByLight,
    },
    {
      id: DataTransformerID.merge,
      editor: lazy(() =>
        import('./editors/MergeTransformerEditor').then((m) => ({ default: m.MergeTransformerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.mergeTransformer),
      isApplicable: standardTransformers.mergeTransformer.isApplicable,
      isApplicableDescription: standardTransformers.mergeTransformer.isApplicableDescription,
      name: t('transformers.merge-transformer-editor.name.merge', 'Merge series/tables'),
      description: t(
        'transformers.merge-transformer-editor.description.merge-multiple-series',
        'Merge multiple series. Values will be combined into one row.'
      ),
      categories: new Set([TransformerCategory.Combine]),
      imageDark: mergeDark,
      imageLight: mergeLight,
    },
    {
      id: DataTransformerID.histogram,
      editor: lazy(() =>
        import('./editors/HistogramTransformerEditor').then((m) => ({ default: m.HistogramTransformerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.histogramTransformer),
      name: t('transformers.histogram-transformer-editor.name.histogram', 'Histogram'),
      description: t(
        'transformers.histogram-transformer-editor.description.calculate-histogram-from-input-data',
        'Calculate a histogram from input data.'
      ),
      categories: new Set([TransformerCategory.CreateNewVisualization]),
      imageDark: histogramDark,
      imageLight: histogramLight,
    },
    {
      id: DataTransformerID.rowsToFields,
      editor: lazy(() =>
        import('./rowsToFields/RowsToFieldsTransformerEditor').then((m) => ({
          default: m.RowsToFieldsTransformerEditor,
        }))
      ),
      transformation: () => import('./rowsToFields/rowsToFields').then((m) => m.getRowsToFieldsTransformer()),
      name: t('transformers.get-rows-to-fields-transformer.name.rows-to-fields', 'Rows to fields'),
      description: t(
        'transformers.get-rows-to-fields-transformer.description.convert-field-dynamic-config',
        'Convert each row into a field with dynamic config.'
      ),
      state: PluginState.beta,
      categories: new Set([TransformerCategory.Reformat]),
      imageDark: rowsToFieldsDark,
      imageLight: rowsToFieldsLight,
    },
    {
      id: DataTransformerID.configFromData,
      editor: lazy(() =>
        import('./configFromQuery/ConfigFromQueryTransformerEditor').then((m) => ({
          default: m.ConfigFromQueryTransformerEditor,
        }))
      ),
      transformation: () => import('./configFromQuery/configFromQuery').then((m) => m.getConfigFromDataTransformer()),
      name: t(
        'transformers.get-config-from-data-transformer.name.config-from-query-results',
        'Config from query results'
      ),
      description: t(
        'transformers.get-config-from-data-transformer.description.set-unit-min-max-and-more',
        'Set unit, min, max and more.'
      ),
      state: PluginState.beta,
      categories: new Set([TransformerCategory.CalculateNewFields]),
      imageDark: configFromDataDark,
      imageLight: configFromDataLight,
    },
    {
      id: DataTransformerID.prepareTimeSeries,
      editor: lazy(() =>
        import('./prepareTimeSeries/PrepareTimeSeriesEditor').then((m) => ({
          default: m.PrepareTimeSeriesEditor,
        }))
      ),
      transformation: () =>
        import('./prepareTimeSeries/prepareTimeSeries').then((m) => m.getPrepareTimeSeriesTransformer()),
      name: t('transformers.prepare-time-series.name.prepare-time-series', 'Prepare time series'),
      description: t(
        'transformers.prepare-time-series.description.stretch-data-frames',
        'Stretch data frames from the wide format into the long format.'
      ),
      categories: new Set([TransformerCategory.Reformat]),
      imageDark: prepareTimeSeriesDark,
      imageLight: prepareTimeSeriesLight,
    },
    {
      id: DataTransformerID.convertFieldType,
      editor: lazy(() =>
        import('./editors/ConvertFieldTypeTransformerEditor').then((m) => ({
          default: m.ConvertFieldTypeTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.convertFieldTypeTransformer),
      defaultOptions: standardTransformers.convertFieldTypeTransformer.defaultOptions,
      name: t('transformers.convert-field-type-transformer-editor.name.convert-field-type', 'Convert field type'),
      description: t(
        'transformers.convert-field-type-transformer-editor.description.convert-to-specified-field-type',
        'Convert a field to a specified field type.'
      ),
      categories: new Set([TransformerCategory.Reformat]),
      tags: new Set([t('transformers.convert-field-type-transformer-editor.tags.format-field', 'Format field')]),
      imageDark: convertFieldTypeDark,
      imageLight: convertFieldTypeLight,
    },
    {
      id: DataTransformerID.spatial,
      editor: lazy(() =>
        import('./spatial/SpatialTransformerEditor').then((m) => ({ default: m.SetGeometryTransformerEditor }))
      ),
      transformation: () => import('./spatial/spatialTransformer').then((m) => m.getSpatialTransformer()),
      name: t('transformers.get-spatial-transformer.name.spatial-operations', 'Spatial operations'),
      description: t(
        'transformers.get-spatial-transformer.description.apply-spatial-operations-to-query-results',
        'Apply spatial operations to query results.'
      ),
      state: PluginState.alpha,
      categories: new Set([TransformerCategory.PerformSpatialOperations]),
      imageDark: spatialDark,
      imageLight: spatialLight,
    },
    {
      id: DataTransformerID.fieldLookup,
      editor: lazy(() =>
        import('./lookupGazetteer/FieldLookupTransformerEditor').then((m) => ({
          default: m.FieldLookupTransformerEditor,
        }))
      ),
      transformation: () => import('./lookupGazetteer/fieldLookup').then((m) => m.fieldLookupTransformer),
      name: t(
        'transformers.field-lookup-transformer-editor.name.lookup-fields-from-resource',
        'Lookup fields from resource'
      ),
      description: t(
        'transformers.field-lookup-transformer-editor.description.lookup-additional-fields-external-source',
        'Use a field value to lookup countries, states, or airports.'
      ),
      state: PluginState.alpha,
      categories: new Set([TransformerCategory.PerformSpatialOperations]),
      imageDark: fieldLookupDark,
      imageLight: fieldLookupLight,
    },
    {
      id: DataTransformerID.extractFields,
      editor: lazy(() =>
        import('./extractFields/ExtractFieldsTransformerEditor').then((m) => ({
          default: m.extractFieldsTransformerEditor,
        }))
      ),
      transformation: () => import('./extractFields/extractFields').then((m) => m.extractFieldsTransformer),
      name: t('transformers.extract-fields-transformer-editor.name.extract-fields', 'Extract fields'),
      description: t(
        'transformers.extract-fields-transformer-editor.description.parse-fields-from-content',
        'Parse fields from content (JSON, labels, etc).'
      ),
      categories: new Set([TransformerCategory.Reformat]),
      imageDark: extractFieldsDark,
      imageLight: extractFieldsLight,
    },
    {
      id: DataTransformerID.heatmap,
      editor: lazy(() =>
        import('./calculateHeatmap/HeatmapTransformerEditor').then((m) => ({
          default: m.HeatmapTransformerEditor,
        }))
      ),
      transformation: () => import('./calculateHeatmap/heatmap').then((m) => m.getHeatmapTransformer()),
      name: t('transformers.get-heatmap-transformer.name.create-heatmap', 'Create heatmap'),
      description: t(
        'transformers.get-heatmap-transformer.description.generate-heatmap-data-from-source',
        'Generate heatmap data from source data.'
      ),
      state: PluginState.alpha,
      categories: new Set([TransformerCategory.CreateNewVisualization]),
      isApplicable: isHeatmapApplicable,
      isApplicableDescription: t(
        'transformers.heatmap.is-applicable-description',
        'The Heatmap transformation requires fields with Heatmap compatible data. No fields with Heatmap data could be found.'
      ),
      imageDark: heatmapDark,
      imageLight: heatmapLight,
    },
    {
      id: DataTransformerID.groupingToMatrix,
      editor: lazy(() =>
        import('./editors/GroupingToMatrixTransformerEditor').then((m) => ({
          default: m.GroupingToMatrixTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.groupingToMatrixTransformer),
      name: t('transformers.grouping-to-matrix-transformer-editor.name.grouping-to-matrix', 'Grouping to matrix'),
      description: t(
        'transformers.grouping-to-matrix-transformer-editor.description.summarize-and-reorganize-data',
        'Summarize and reorganize data based on three fields.'
      ),
      categories: new Set([TransformerCategory.Combine, TransformerCategory.Reformat]),
      imageDark: groupingToMatrixDark,
      imageLight: groupingToMatrixLight,
    },
    {
      id: DataTransformerID.limit,
      editor: lazy(() =>
        import('./editors/LimitTransformerEditor').then((m) => ({ default: m.LimitTransformerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.limitTransformer),
      name: t('transformers.limit-transformer-editor.name.limit', 'Limit'),
      description: t(
        'transformers.limit-transformer-editor.description.limit-number-items-displayed',
        'Limit the number of items displayed.'
      ),
      categories: new Set([TransformerCategory.Filter]),
      imageDark: limitDark,
      imageLight: limitLight,
    },
    {
      id: DataTransformerID.joinByLabels,
      editor: lazy(() =>
        import('./joinByLabels/JoinByLabelsTransformerEditor').then((m) => ({
          default: m.JoinByLabelsTransformerEditor,
        }))
      ),
      transformation: () => import('./joinByLabels/joinByLabels').then((m) => m.getJoinByLabelsTransformer()),
      name: t('transformers.get-join-by-labels-transformer.name.join-by-labels', 'Join by labels'),
      description: t(
        'transformers.get-join-by-labels-transformer.description.flatten-labeled-results-table-joined-labels',
        'Flatten labeled results into a table joined by labels.'
      ),
      state: PluginState.beta,
      categories: new Set([TransformerCategory.Combine]),
      imageDark: joinByLabelsDark,
      imageLight: joinByLabelsLight,
    },
    {
      id: DataTransformerID.regression,
      editor: lazy(() =>
        import('./regression/regressionEditor').then((m) => ({ default: m.RegressionTransformerEditor }))
      ),
      transformation: () => import('./regression/regression').then((m) => m.getRegressionTransformer()),
      name: t('transformers.regression.name.trendline', 'Trendline'),
      description: t(
        'transformers.regression.description.create-new-data-frame',
        'Create a new data frame containing values predicted by a statistical model.'
      ),
      categories: new Set([TransformerCategory.CalculateNewFields]),
      tags: new Set([t('transformers.regression-transformer-editor.tags.regression-analysis', 'Regression analysis')]),
      imageDark: regressionDark,
      imageLight: regressionLight,
    },
    {
      id: DataTransformerID.partitionByValues,
      editor: lazy(() =>
        import('./partitionByValues/PartitionByValuesEditor').then((m) => ({
          default: m.PartitionByValuesEditor,
        }))
      ),
      transformation: () =>
        import('./partitionByValues/partitionByValues').then((m) => m.getPartitionByValuesTransformer()),
      name: t('transformers.get-partition-by-values-transformer.name.partition-by-values', 'Partition by values'),
      description: t(
        'transformers.get-partition-by-values-transformer.description.split-oneframe-dataset-multiple-series',
        'Split a one-frame dataset into multiple series.'
      ),
      state: PluginState.alpha,
      categories: new Set([TransformerCategory.Reformat]),
      imageDark: partitionByValuesDark,
      imageLight: partitionByValuesLight,
    },
    {
      id: DataTransformerID.formatString,
      editor: lazy(() =>
        import('./editors/FormatStringTransformerEditor').then((m) => ({
          default: m.FormatStringTransfomerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.formatStringTransformer),
      name: t('transformers.format-string-transformer-editor.name.format-string', 'Format string'),
      state: PluginState.beta,
      description: t(
        'transformers.format-string-transformer-editor.description.manipulate-string-fields-formatting',
        'Manipulate string fields formatting.'
      ),
      categories: new Set([TransformerCategory.Reformat]),
      imageDark: formatStringDark,
      imageLight: formatStringLight,
    },
    {
      id: DataTransformerID.groupToNestedTable,
      editor: lazy(() =>
        import('./editors/GroupToNestedTableTransformerEditor/index').then((m) => ({
          default: m.GroupToNestedTableTransformerEditor,
        }))
      ),
      transformation: () => Promise.resolve(standardTransformers.groupToNestedTable),
      name: t(
        'transformers.group-to-nested-table-transformer-editor.name.group-to-nested-tables',
        'Group to nested tables'
      ),
      description: t(
        'transformers.group-to-nested-table-transformer-editor.description.group-by-field-value',
        'Group data by a field value and create nested tables with the grouped data.'
      ),
      categories: new Set([
        TransformerCategory.Combine,
        TransformerCategory.CalculateNewFields,
        TransformerCategory.Reformat,
      ]),
      state: PluginState.beta,
      imageDark: groupToNestedTableDark,
      imageLight: groupToNestedTableLight,
    },
    ...(config.featureToggles.smoothingTransformation
      ? [
          {
            id: DataTransformerID.smoothing,
            editor: lazy(() =>
              import('./smoothing/smoothingEditor').then((m) => ({ default: m.SmoothingTransformerEditor }))
            ),
            transformation: () => import('./smoothing/smoothing').then((m) => m.getSmoothingTransformer()),
            name: t('transformers.smoothing.name', 'Smoothing'),
            description: t(
              'transformers.smoothing.description',
              'Reduce noise in time series data through adaptive downsampling.'
            ),
            categories: new Set([TransformerCategory.CalculateNewFields]),
            isApplicable: isSmoothingApplicable,
            isApplicableDescription: t(
              'transformers.smoothing.is-applicable-description',
              'The Smoothing transformation requires at least one time series frame to function. You currently have none.'
            ),
            tags: new Set(['ASAP', 'Autosmooth']),
            imageDark: smoothingDark,
            imageLight: smoothingLight,
          },
        ]
      : []),
    {
      id: DataTransformerID.formatTime,
      editor: lazy(() =>
        import('./editors/FormatTimeTransformerEditor').then((m) => ({ default: m.FormatTimeTransfomerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.formatTimeTransformer),
      isApplicable: standardTransformers.formatTimeTransformer.isApplicable,
      isApplicableDescription: standardTransformers.formatTimeTransformer.isApplicableDescription,
      name: t('transformers.format-time-transformer-editor.name.format-time', 'Format time'),
      state: PluginState.alpha,
      description: t(
        'transformers.format-time-transformer-editor.description.set-based-on-time',
        'Set the output format of a time field'
      ),
      categories: new Set([TransformerCategory.Reformat]),
      imageDark: formatTimeDark,
      imageLight: formatTimeLight,
    },
    {
      id: DataTransformerID.timeSeriesTable,
      editor: lazy(() =>
        import('./timeSeriesTable/TimeSeriesTableTransformEditor').then((m) => ({
          default: m.TimeSeriesTableTransformEditor,
        }))
      ),
      transformation: () =>
        import('./timeSeriesTable/timeSeriesTableTransformer').then((m) => m.getTimeSeriesTableTransformer()),
      name: t('transformers.time-series-table.name.time-series-to-table', 'Time series to table'),
      description: t(
        'transformers.time-series-table.description.convert-to-table-rows',
        'Convert time series data to table rows so that they can be viewed in tabular or sparkline format.'
      ),
      state: PluginState.beta,
      isApplicable: isTimeSeriesTableApplicable,
      isApplicableDescription: t(
        'transformers.time-series-table.is-applicable-description.requires-time-series-frame',
        'The Time series to table transformation requires at least one time series frame to function. You currently have none.'
      ),
      imageDark: timeSeriesTableDark,
      imageLight: timeSeriesTableLight,
    },
    {
      id: DataTransformerID.transpose,
      editor: lazy(() =>
        import('./editors/TransposeTransformerEditor').then((m) => ({ default: m.TransposeTransformerEditor }))
      ),
      transformation: () => Promise.resolve(standardTransformers.transposeTransformer),
      name: t('transformers.transpose-transformer-editor.name.transpose', 'Transpose'),
      description: t(
        'transformers.transpose-transformer-editor.description.transpose-data-frame',
        'Transpose the data frame.'
      ),
      categories: new Set([TransformerCategory.Reformat]),
      tags: new Set([
        t('transformers.transpose-transformer-editor.tags.pivot', 'Pivot'),
        t('transformers.transpose-transformer-editor.tags.translate', 'Translate'),
        t('transformers.transpose-transformer-editor.tags.transform', 'Transform'),
      ]),
      imageDark: transposeDark,
      imageLight: transposeLight,
    },
    hiddenTransformer(DataTransformerID.ensureColumns, () =>
      Promise.resolve(standardTransformers.ensureColumnsTransformer)
    ),
    hiddenTransformer(DataTransformerID.noop, () => Promise.resolve(standardTransformers.noopTransformer)),
    hiddenTransformer(DataTransformerID.order, () => Promise.resolve(standardTransformers.orderFieldsTransformer)),
    hiddenTransformer(DataTransformerID.rename, () => Promise.resolve(standardTransformers.renameFieldsTransformer)),
    hiddenTransformer(DataTransformerID.filterFields, () =>
      Promise.resolve(standardTransformers.filterFieldsTransformer)
    ),
    hiddenTransformer(DataTransformerID.filterFrames, () =>
      Promise.resolve(standardTransformers.filterFramesTransformer)
    ),
    hiddenTransformer(DataTransformerID.convertFrameType, () =>
      Promise.resolve(standardTransformers.convertFrameTypeTransformer)
    ),
    // No dedicated append transformer exists; noop ensures safe passthrough for saved dashboards that reference this id
    hiddenTransformer(DataTransformerID.append, () => Promise.resolve(standardTransformers.noopTransformer)),
  ];
};
