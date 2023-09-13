import { getLinkToDocs } from './getLinkToDocs';

import {
  CalculateFieldHelper,
  concatenateHelper,
  ConfigFromQueryHelper,
  ConvertFieldTypeHelper,
  CreateHeatmapHelp,
  ExtractFieldsHelper,
  FieldLookupHelper,
  FilterByRefIdHelper,
  FilterByValueHelper,
  FilterFieldsByNameHelper,
  FormatTimeHelper,
  GroupByHelper,
  GroupingToMatrixHelper,
  HistogramHelper,
  JoinByFieldHelper,
  JoinByLabelsHelper,
  LabelsToFieldsHelper,
  LimitHelper,
  MergeHelper,
  OrganizeFieldsHelper,
  PartitionByValuesHelper,
  PrepareTimeSeriesHelper,
  ReduceHelper,
  RenameByRegexHelper,
  RowsToFieldsHelper,
  SeriesToRowsHelper,
  SortByHelper,
  SpatialHelper,
  TimeSeriesTableHelper,
} from './index';

const helperContent: Record<string, () => string> = {
  calculateField: CalculateFieldHelper,
  concatenate: concatenateHelper,
  configFromData: ConfigFromQueryHelper,
  convertFieldType: ConvertFieldTypeHelper,
  extractFields: ExtractFieldsHelper,
  fieldLookup: FieldLookupHelper,
  filterByRefId: FilterByRefIdHelper,
  filterByValue: FilterByValueHelper,
  filterFieldsByName: FilterFieldsByNameHelper,
  formatTime: FormatTimeHelper,
  groupBy: GroupByHelper,
  groupingToMatrix: GroupingToMatrixHelper,
  heatmap: CreateHeatmapHelp,
  histogram: HistogramHelper,
  joinByField: JoinByFieldHelper,
  joinByLabels: JoinByLabelsHelper,
  labelsToFields: LabelsToFieldsHelper,
  limit: LimitHelper,
  merge: MergeHelper,
  organize: OrganizeFieldsHelper,
  partitionByValues: PartitionByValuesHelper,
  prepareTimeSeries: PrepareTimeSeriesHelper,
  reduce: ReduceHelper,
  renameByRegex: RenameByRegexHelper,
  rowsToFields: RowsToFieldsHelper,
  seriesToRows: SeriesToRowsHelper,
  sortBy: SortByHelper,
  spatial: SpatialHelper,
  timeSeriesTable: TimeSeriesTableHelper,
};

export function getHelperContent(id: string): string {
  const defaultMessage = getLinkToDocs();

  if (id in helperContent) {
    return helperContent[id]();
  }

  return defaultMessage;
}
