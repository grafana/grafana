import { lazy } from 'react';

import {
  DataTransformerID,
  PluginState,
  TransformerCategory,
  type TransformerRegistryItem,
} from '@grafana/data';
// Direct import from internal path - this module is no longer publicly exported from @grafana/data
// to avoid pulling all transformer implementations into the plugin-facing shared chunk.
// Webpack resolves @grafana/data to source via the @grafana-app/source condition.
// eslint-disable-next-line no-restricted-imports
import { standardTransformers } from '../../../../packages/grafana-data/src/transformations/transformers';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { getHeatmapTransformer } from './calculateHeatmap/heatmap';
import { getConfigFromDataTransformer } from './configFromQuery/configFromQuery';
import { extractFieldsTransformer } from './extractFields/extractFields';
import { getJoinByLabelsTransformer } from './joinByLabels/joinByLabels';
import { fieldLookupTransformer } from './lookupGazetteer/fieldLookup';
import { getPartitionByValuesTransformer } from './partitionByValues/partitionByValues';
import { getPrepareTimeSeriesTransformer } from './prepareTimeSeries/prepareTimeSeries';
import { getRegressionTransformer } from './regression/regression';
import { getRowsToFieldsTransformer } from './rowsToFields/rowsToFields';
import { getSmoothingTransformer } from './smoothing/smoothing';
import { getSpatialTransformer } from './spatial/spatialTransformer';
import { getTimeSeriesTableTransformer } from './timeSeriesTable/timeSeriesTableTransformer';

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
import groupingToMatrixDark from './images/dark/groupingToMatrix.svg';
import groupToNestedTableDark from './images/dark/groupToNestedTable.svg';
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
import groupingToMatrixLight from './images/light/groupingToMatrix.svg';
import groupToNestedTableLight from './images/light/groupToNestedTable.svg';
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

export const getStandardTransformers = (): TransformerRegistryItem[] => {
  return [
    {
      id: DataTransformerID.reduce,
      editor: lazy(() =>
        import('./editors/ReduceTransformerEditor').then((m) => ({ default: m.ReduceTransformerEditor }))
      ),
      transformation: standardTransformers.reduceTransformer,
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
      transformation: standardTransformers.filterFieldsByNameTransformer,
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
      transformation: standardTransformers.renameByRegexTransformer,
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
      transformation: standardTransformers.filterFramesByRefIdTransformer,
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
      transformation: standardTransformers.filterByValueTransformer,
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
      transformation: standardTransformers.organizeFieldsTransformer,
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
      transformation: standardTransformers.joinByFieldTransformer,
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
      transformation: standardTransformers.seriesToRowsTransformer,
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
      transformation: standardTransformers.concatenateTransformer,
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
      transformation: standardTransformers.calculateFieldTransformer,
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
      transformation: standardTransformers.labelsToFieldsTransformer,
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
      transformation: standardTransformers.groupByTransformer,
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
      transformation: standardTransformers.sortByTransformer,
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
      transformation: standardTransformers.mergeTransformer,
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
      transformation: standardTransformers.histogramTransformer,
      name: t('transformers.histogram-transformer-editor.name.histogram', 'Histogram'),
      description: t(
        'transformers.histogram-transformer-editor.description.calculate-histogram-from-input-data',
        'Calculate a histogram from input data.'
      ),
      categories: new Set([TransformerCategory.CreateNewVisualization]),
      imageDark: histogramDark,
      imageLight: histogramLight,
    },
    (() => {
      const rowsToFieldsTransformer = getRowsToFieldsTransformer();
      return {
        id: rowsToFieldsTransformer.id,
        editor: lazy(() =>
          import('./rowsToFields/RowsToFieldsTransformerEditor').then((m) => ({
            default: m.RowsToFieldsTransformerEditor,
          }))
        ),
        transformation: rowsToFieldsTransformer,
        name: rowsToFieldsTransformer.name,
        description: rowsToFieldsTransformer.description,
        state: PluginState.beta,
        categories: new Set([TransformerCategory.Reformat]),
        imageDark: rowsToFieldsDark,
        imageLight: rowsToFieldsLight,
      };
    })(),
    (() => {
      const configFromDataTransformer = getConfigFromDataTransformer();
      return {
        id: configFromDataTransformer.id,
        editor: lazy(() =>
          import('./configFromQuery/ConfigFromQueryTransformerEditor').then((m) => ({
            default: m.ConfigFromQueryTransformerEditor,
          }))
        ),
        transformation: configFromDataTransformer,
        name: configFromDataTransformer.name,
        description: configFromDataTransformer.description,
        state: PluginState.beta,
        categories: new Set([TransformerCategory.CalculateNewFields]),
        imageDark: configFromDataDark,
        imageLight: configFromDataLight,
      };
    })(),
    (() => {
      const prepareTimeSeriesTransformer = getPrepareTimeSeriesTransformer();
      return {
        id: prepareTimeSeriesTransformer.id,
        editor: lazy(() =>
          import('./prepareTimeSeries/PrepareTimeSeriesEditor').then((m) => ({
            default: m.PrepareTimeSeriesEditor,
          }))
        ),
        transformation: prepareTimeSeriesTransformer,
        name: prepareTimeSeriesTransformer.name,
        description: prepareTimeSeriesTransformer.description,
        categories: new Set([TransformerCategory.Reformat]),
        imageDark: prepareTimeSeriesDark,
        imageLight: prepareTimeSeriesLight,
      };
    })(),
    {
      id: DataTransformerID.convertFieldType,
      editor: lazy(() =>
        import('./editors/ConvertFieldTypeTransformerEditor').then((m) => ({
          default: m.ConvertFieldTypeTransformerEditor,
        }))
      ),
      transformation: standardTransformers.convertFieldTypeTransformer,
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
    (() => {
      const spatialTransformer = getSpatialTransformer();
      return {
        id: DataTransformerID.spatial,
        editor: lazy(() =>
          import('./spatial/SpatialTransformerEditor').then((m) => ({ default: m.SetGeometryTransformerEditor }))
        ),
        transformation: spatialTransformer,
        name: spatialTransformer.name,
        description: spatialTransformer.description,
        state: PluginState.alpha,
        categories: new Set([TransformerCategory.PerformSpatialOperations]),
        imageDark: spatialDark,
        imageLight: spatialLight,
      };
    })(),
    {
      id: DataTransformerID.fieldLookup,
      editor: lazy(() =>
        import('./lookupGazetteer/FieldLookupTransformerEditor').then((m) => ({
          default: m.FieldLookupTransformerEditor,
        }))
      ),
      transformation: fieldLookupTransformer,
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
      transformation: extractFieldsTransformer,
      name: t('transformers.extract-fields-transformer-editor.name.extract-fields', 'Extract fields'),
      description: t(
        'transformers.extract-fields-transformer-editor.description.parse-fields-from-content',
        'Parse fields from content (JSON, labels, etc).'
      ),
      categories: new Set([TransformerCategory.Reformat]),
      imageDark: extractFieldsDark,
      imageLight: extractFieldsLight,
    },
    (() => {
      const heatmapTransformer = getHeatmapTransformer();
      return {
        id: heatmapTransformer.id,
        editor: lazy(() =>
          import('./calculateHeatmap/HeatmapTransformerEditor').then((m) => ({
            default: m.HeatmapTransformerEditor,
          }))
        ),
        transformation: heatmapTransformer,
        name: heatmapTransformer.name,
        description: heatmapTransformer.description,
        state: PluginState.alpha,
        categories: new Set([TransformerCategory.CreateNewVisualization]),
        imageDark: heatmapDark,
        imageLight: heatmapLight,
      };
    })(),
    {
      id: DataTransformerID.groupingToMatrix,
      editor: lazy(() =>
        import('./editors/GroupingToMatrixTransformerEditor').then((m) => ({
          default: m.GroupingToMatrixTransformerEditor,
        }))
      ),
      transformation: standardTransformers.groupingToMatrixTransformer,
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
      transformation: standardTransformers.limitTransformer,
      name: t('transformers.limit-transformer-editor.name.limit', 'Limit'),
      description: t(
        'transformers.limit-transformer-editor.description.limit-number-items-displayed',
        'Limit the number of items displayed.'
      ),
      categories: new Set([TransformerCategory.Filter]),
      imageDark: limitDark,
      imageLight: limitLight,
    },
    (() => {
      const joinByLabelsTransformer = getJoinByLabelsTransformer();
      return {
        id: joinByLabelsTransformer.id,
        editor: lazy(() =>
          import('./joinByLabels/JoinByLabelsTransformerEditor').then((m) => ({
            default: m.JoinByLabelsTransformerEditor,
          }))
        ),
        transformation: joinByLabelsTransformer,
        name: joinByLabelsTransformer.name,
        description: joinByLabelsTransformer.description,
        state: PluginState.beta,
        categories: new Set([TransformerCategory.Combine]),
        imageDark: joinByLabelsDark,
        imageLight: joinByLabelsLight,
      };
    })(),
    (() => {
      const regressionTransformer = getRegressionTransformer();
      return {
        id: DataTransformerID.regression,
        editor: lazy(() =>
          import('./regression/regressionEditor').then((m) => ({ default: m.RegressionTransformerEditor }))
        ),
        transformation: regressionTransformer,
        name: regressionTransformer.name,
        description: regressionTransformer.description,
        categories: new Set([TransformerCategory.CalculateNewFields]),
        tags: new Set([
          t('transformers.regression-transformer-editor.tags.regression-analysis', 'Regression analysis'),
        ]),
        imageDark: regressionDark,
        imageLight: regressionLight,
      };
    })(),
    (() => {
      const partitionByValuesTransformer = getPartitionByValuesTransformer();
      return {
        id: DataTransformerID.partitionByValues,
        editor: lazy(() =>
          import('./partitionByValues/PartitionByValuesEditor').then((m) => ({
            default: m.PartitionByValuesEditor,
          }))
        ),
        transformation: partitionByValuesTransformer,
        name: partitionByValuesTransformer.name,
        description: partitionByValuesTransformer.description,
        state: PluginState.alpha,
        categories: new Set([TransformerCategory.Reformat]),
        imageDark: partitionByValuesDark,
        imageLight: partitionByValuesLight,
      };
    })(),
    {
      id: DataTransformerID.formatString,
      editor: lazy(() =>
        import('./editors/FormatStringTransformerEditor').then((m) => ({
          default: m.FormatStringTransfomerEditor,
        }))
      ),
      transformation: standardTransformers.formatStringTransformer,
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
        import('./editors/GroupToNestedTableTransformerEditor').then((m) => ({
          default: m.GroupToNestedTableTransformerEditor,
        }))
      ),
      transformation: standardTransformers.groupToNestedTable,
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
          (() => {
            const smoothingTransformer = getSmoothingTransformer();
            return {
              id: DataTransformerID.smoothing,
              editor: lazy(() =>
                import('./smoothing/smoothingEditor').then((m) => ({ default: m.SmoothingTransformerEditor }))
              ),
              transformation: smoothingTransformer,
              name: smoothingTransformer.name,
              description: smoothingTransformer.description,
              categories: new Set([TransformerCategory.CalculateNewFields]),
              tags: new Set(['ASAP', 'Autosmooth']),
              imageDark: smoothingDark,
              imageLight: smoothingLight,
            };
          })(),
        ]
      : []),
    {
      id: DataTransformerID.formatTime,
      editor: lazy(() =>
        import('./editors/FormatTimeTransformerEditor').then((m) => ({ default: m.FormatTimeTransfomerEditor }))
      ),
      transformation: standardTransformers.formatTimeTransformer,
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
    (() => {
      const timeSeriesTableTransformer = getTimeSeriesTableTransformer();
      return {
        id: timeSeriesTableTransformer.id,
        editor: lazy(() =>
          import('./timeSeriesTable/TimeSeriesTableTransformEditor').then((m) => ({
            default: m.TimeSeriesTableTransformEditor,
          }))
        ),
        transformation: timeSeriesTableTransformer,
        name: timeSeriesTableTransformer.name,
        description: timeSeriesTableTransformer.description,
        state: PluginState.beta,
        imageDark: timeSeriesTableDark,
        imageLight: timeSeriesTableLight,
      };
    })(),
    {
      id: DataTransformerID.transpose,
      editor: lazy(() =>
        import('./editors/TransposeTransformerEditor').then((m) => ({ default: m.TransposeTransformerEditor }))
      ),
      transformation: standardTransformers.transposeTransformer,
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
  ];
};
