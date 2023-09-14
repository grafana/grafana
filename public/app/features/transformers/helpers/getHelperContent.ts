import { getLinkToDocs } from './getLinkToDocs';

import {
  calculateFieldHelper,
  concatenateHelper,
  configFromQueryHelper,
  convertFieldTypeHelper,
  createHeatmapHelp,
  extractFieldsHelper,
  fieldLookupHelper,
  filterByRefIdHelper,
  filterByValueHelper,
  filterFieldsByNameHelper,
  formatTimeHelper,
  groupByHelper,
  groupingToMatrixHelper,
  histogramHelper,
  joinByFieldHelper,
  joinByLabelsHelper,
  labelsToFieldsHelper,
  limitHelper,
  mergeHelper,
  organizeFieldsHelper,
  partitionByValuesHelper,
  prepareTimeSeriesHelper,
  reduceHelper,
  renameByRegexHelper,
  rowsToFieldsHelper,
  seriesToRowsHelper,
  sortByHelper,
  spatialHelper,
  timeSeriesTableHelper,
} from './index';

const helperContent: Record<string, () => string> = {
  calculateField: calculateFieldHelper,
  concatenate: concatenateHelper,
  configFromData: configFromQueryHelper,
  convertFieldType: convertFieldTypeHelper,
  extractFields: extractFieldsHelper,
  fieldLookup: fieldLookupHelper,
  filterByRefId: filterByRefIdHelper,
  filterByValue: filterByValueHelper,
  filterFieldsByName: filterFieldsByNameHelper,
  formatTime: formatTimeHelper,
  groupBy: groupByHelper,
  groupingToMatrix: groupingToMatrixHelper,
  heatmap: createHeatmapHelp,
  histogram: histogramHelper,
  joinByField: joinByFieldHelper,
  joinByLabels: joinByLabelsHelper,
  labelsToFields: labelsToFieldsHelper,
  limit: limitHelper,
  merge: mergeHelper,
  organize: organizeFieldsHelper,
  partitionByValues: partitionByValuesHelper,
  prepareTimeSeries: prepareTimeSeriesHelper,
  reduce: reduceHelper,
  renameByRegex: renameByRegexHelper,
  rowsToFields: rowsToFieldsHelper,
  seriesToRows: seriesToRowsHelper,
  sortBy: sortByHelper,
  spatial: spatialHelper,
  timeSeriesTable: timeSeriesTableHelper,
};

export function getHelperContent(id: string): string {
  const defaultMessage = getLinkToDocs();

  if (id in helperContent) {
    return helperContent[id]();
  }

  return defaultMessage;
}
