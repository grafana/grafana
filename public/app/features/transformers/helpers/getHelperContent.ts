import {
  CalculateFieldHelper,
  ConcatenateHelper,
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
} from './index';

const helperContent: Record<string, () => string> = {
  calculateField: CalculateFieldHelper,
  concatenate: ConcatenateHelper,
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
};

export function getHelperContent(id: string): string {
  const defaultMessage = 'u broke it, u buy it';

  if (id in helperContent) {
    return helperContent[id]();
  }

  return defaultMessage;
}
