import {
  calculateFieldHelper,
  concatenateHelper,
  configFromQueryHelper,
  convertFieldTypeHelper,
  createHeatmapHelper,
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
  heatmap: createHeatmapHelper,
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
  if (id in helperContent) {
    return `
    ${helperContent[id]()}
    ${getLinkToDocs()}
    `;
  }

  return getLinkToDocs();
}

export function getLinkToDocs(): string {
  return `
  Go the <a href="https://grafana.com/docs/grafana/latest/panels/transformations/?utm_source=grafana" target="_blank" rel="noreferrer">
  transformation documentation
  </a> for more.
  `;
}
