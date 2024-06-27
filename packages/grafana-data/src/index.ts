/**
 * A library containing most of the core functionality and data types used in Grafana.
 *
 * @packageDocumentation
 */

export * from './types';
export * from './text';
export * from './events';
export * from './themes';
export * from './monaco';
export * from './geo/layer';
export * from './query';
export { amendTable, trimTable, type Table } from './table/amendTimeSeries';

// DataFrames
export { DataFrameView } from './dataframe/DataFrameView';
export { type FieldWithIndex, FieldCache } from './dataframe/FieldCache';
export { type MutableField, MISSING_VALUE, MutableDataFrame } from './dataframe/MutableDataFrame';
export {
  guessFieldTypeFromNameAndValue,
  getFieldTypeFromValue,
  guessFieldTypeFromValue,
  guessFieldTypeForField,
  guessFieldTypes,
  isTableData,
  isDataFrame,
  isDataFrameWithValue,
  toDataFrame,
  toLegacyResponseData,
  sortDataFrame,
  reverseDataFrame,
  getDataFrameRow,
  toDataFrameDTO,
  toFilteredDataFrameDTO,
  getTimeField,
  getProcessedDataFrames,
  preProcessPanelData,
  type PartialDataFrame,
  createDataFrame,
} from './dataframe/processDataFrame';

export {
  type Dimension,
  type Dimensions,
  createDimension,
  getColumnsFromDimension,
  getColumnFromDimension,
  getValueFromDimension,
  getAllValuesFromDimension,
  getDimensionByName,
} from './dataframe/dimensions';

export {
  anySeriesWithTimeField,
  hasTimeField,
  isTimeSeriesFrame,
  isTimeSeriesFrames,
  isTimeSeriesField,
  getRowUniqueId,
  addRow,
} from './dataframe/utils';
export {
  StreamingDataFrame,
  StreamingFrameAction,
  type StreamingFrameOptions,
  closestIdx,
} from './dataframe/StreamingDataFrame';

export { ArrayDataFrame, arrayToDataFrame } from './dataframe/ArrayDataFrame';

export {
  type DataFrameJSON,
  type DataFrameData,
  type DataFrameSchema,
  type FieldSchema,
  type FieldValueEntityLookup,
  decodeFieldValueEntities,
  decodeFieldValueEnums,
  dataFrameFromJSON,
  dataFrameToJSON,
} from './dataframe/DataFrameJSON';

export { compareDataFrameStructures, compareArrayValues, shallowCompare } from './dataframe/frameComparisons';

// Field
export {
  getFieldColorModeForField,
  getFieldColorMode,
  fieldColorModeRegistry,
  type FieldColorMode,
  getFieldSeriesColor,
} from './field/fieldColor';
export { FieldConfigOptionsRegistry } from './field/FieldConfigOptionsRegistry';
export { sortThresholds, getActiveThreshold } from './field/thresholds';
export {
  applyFieldOverrides,
  validateFieldConfig,
  applyRawFieldOverrides,
  useFieldOverrides,
} from './field/fieldOverrides';
export { getFieldDisplayValuesProxy } from './field/getFieldDisplayValuesProxy';
export {
  getFieldDisplayName,
  getFrameDisplayName,
  cacheFieldDisplayNames,
  getUniqueFieldName,
} from './field/fieldState';
export { getScaleCalculator, getFieldConfigWithMinMax, getMinMaxAndDelta } from './field/scale';

export {
  type ReduceDataOptions,
  VAR_SERIES_NAME,
  VAR_FIELD_NAME,
  VAR_FIELD_LABELS,
  VAR_CALC,
  VAR_CELL_PREFIX,
  type FieldSparkline,
  type FieldDisplay,
  type GetFieldDisplayValuesOptions,
  DEFAULT_FIELD_DISPLAY_VALUES_LIMIT,
  getFieldDisplayValues,
  hasLinks,
  getDisplayValueAlignmentFactors,
  fixCellTemplateExpressions,
} from './field/fieldDisplay';

export { getDisplayProcessor, getRawDisplayProcessor } from './field/displayProcessor';

export {
  type StandardEditorContext,
  type StandardEditorProps,
  type StandardEditorsRegistryItem,
  standardFieldConfigEditorRegistry,
  standardEditorsRegistry,
} from './field/standardFieldConfigEditorRegistry';

export {
  identityOverrideProcessor,
  numberOverrideProcessor,
  displayNameOverrideProcessor,
  type NumberFieldConfigSettings,
  type SliderFieldConfigSettings,
  type DataLinksFieldConfigSettings,
  type ValueMappingFieldConfigSettings,
  type SelectFieldConfigSettings,
  type StringFieldConfigSettings,
  type ThresholdsFieldConfigSettings,
  type UnitFieldConfigSettings,
  type FieldColorConfigSettings,
  type StatsPickerConfigSettings,
  type FieldNamePickerConfigSettings,
  dataLinksOverrideProcessor,
  valueMappingsOverrideProcessor,
  selectOverrideProcessor,
  stringOverrideProcessor,
  thresholdsOverrideProcessor,
  unitOverrideProcessor,
  booleanOverrideProcessor,
  FieldNamePickerBaseNameMode,
} from './field/overrides/processors';

// Utils
export { PanelOptionsEditorBuilder, FieldConfigEditorBuilder } from './utils/OptionsUIBuilders';
export { getFlotPairs, getFlotPairsConstant } from './utils/flotPairs';
export { locationUtil } from './utils/location';
export { urlUtil, type UrlQueryMap, type UrlQueryValue, serializeStateToUrlParam, toURLRange } from './utils/url';
export { DataLinkBuiltInVars, mapInternalLinkToExplore } from './utils/dataLinks';
export { DocsId } from './utils/docs';
export { makeClassES5Compatible } from './utils/makeClassES5Compatible';
export { anyToNumber } from './utils/anyToNumber';
export { withLoadingIndicator, type WithLoadingIndicatorOptions } from './utils/withLoadingIndicator';
export { convertOldAngularValueMappings, LegacyMappingType } from './utils/valueMappings';
export { containsSearchFilter, type SearchFilterOptions, getSearchFilterScopedVar } from './utils/variables';
export { renderLegendFormat } from './utils/legend';
export { matchPluginId } from './utils/matchPluginId';

export { type RegistryItem, type RegistryItemWithOptions, Registry } from './utils/Registry';
export {
  getDataSourceRef,
  isDataSourceRef,
  getDataSourceUID,
  onUpdateDatasourceOption,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  onUpdateDatasourceJsonDataOptionSelect,
  onUpdateDatasourceJsonDataOptionChecked,
  onUpdateDatasourceSecureJsonDataOptionSelect,
  onUpdateDatasourceResetOption,
  updateDatasourcePluginOption,
  updateDatasourcePluginJsonDataOption,
  updateDatasourcePluginSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from './utils/datasource';

export { deprecationWarning } from './utils/deprecationWarning';

export {
  CSVHeaderStyle,
  type CSVConfig,
  type CSVParseCallbacks,
  type CSVOptions,
  readCSV,
  CSVReader,
  toCSV,
} from './utils/csv';

export { parseLabels, findCommonLabels, findUniqueLabels, matchAllLabels, formatLabels } from './utils/labels';
export { roundDecimals, guessDecimals } from './utils/numbers';
export { objRemoveUndefined, isEmptyObject } from './utils/object';
export { classicColors } from './utils/namedColorsPalette';
export { getSeriesTimeStep, hasMsResolution } from './utils/series';
export { BinaryOperationID, type BinaryOperation, binaryOperators } from './utils/binaryOperators';
export { UnaryOperationID, type UnaryOperation, unaryOperators } from './utils/unaryOperators';
export { NodeGraphDataFrameFieldNames } from './utils/nodeGraph';
export { toOption } from './utils/selectUtils';
export * as arrayUtils from './utils/arrayUtils';
export { store } from './utils/store';
export { LocalStorageValueProvider } from './utils/LocalStorageValueProvider';

// Tranformations
export { standardTransformers } from './transformations/transformers';
export {
  fieldMatchers,
  frameMatchers,
  valueMatchers,
  getFieldMatcher,
  getFrameMatchers,
  getValueMatcher,
} from './transformations/matchers';
export { type FieldValueMatcherConfig } from './transformations/matchers/fieldValueMatcher';

export { DataTransformerID } from './transformations/transformers/ids';
export { MatcherID, FieldMatcherID, FrameMatcherID, ValueMatcherID } from './transformations/matchers/ids';

export {
  ReducerID,
  isReducerID,
  type FieldReducerInfo,
  reduceField,
  fieldReducers,
  defaultCalcs,
  doStandardCalcs,
} from './transformations/fieldReducer';

export { transformDataFrame } from './transformations/transformDataFrame';
export {
  type TransformerRegistryItem,
  type TransformerUIProps,
  TransformerCategory,
  standardTransformersRegistry,
} from './transformations/standardTransformersRegistry';
export {
  type RegexpOrNamesMatcherOptions,
  type ByNamesMatcherOptions,
  ByNamesMatcherMode,
} from './transformations/matchers/nameMatcher';
export type { RenameByRegexTransformerOptions } from './transformations/transformers/renameByRegex';
/** @deprecated -- will be removed in future versions */
export {
  joinDataFrames as outerJoinDataFrames,
  isLikelyAscendingVector,
} from './transformations/transformers/joinDataFrames';
export * from './transformations/transformers/histogram';
export { ensureTimeField } from './transformations/transformers/convertFieldType';

// Required for Sparklines util to work in @grafana/data, but ideally kept internal
export { applyNullInsertThreshold } from './transformations/transformers/nulls/nullInsertThreshold';
export { nullToValue } from './transformations/transformers/nulls/nullToValue';

// ValueFormats
export {
  type FormattedValue,
  type ValueFormatter,
  type ValueFormat,
  type ValueFormatCategory,
  type ValueFormatterIndex,
  formattedValueToString,
  toFixed,
  toFixedScaled,
  toFixedUnit,
  isBooleanUnit,
  booleanValueFormatter,
  scaledUnits,
  locale,
  simpleCountUnit,
  stringFormater,
  getValueFormat,
  getValueFormatterIndex,
  getValueFormats,
} from './valueFormats/valueFormats';

// datetime
export * as dateMath from './datetime/datemath';
export * as rangeUtil from './datetime/rangeutil';
export {
  ISO_8601,
  type DateTimeBuiltinFormat,
  type DateTimeInput,
  type FormatInput,
  type DurationInput,
  type DurationUnit,
  type DateTimeLocale,
  type DateTimeDuration,
  type DateTime,
  setLocale,
  getLocale,
  getLocaleData,
  isDateTimeInput,
  isDateTime,
  toUtc,
  toDuration,
  dateTime,
  dateTimeAsMoment,
  dateTimeForTimeZone,
  getWeekdayIndex,
  getWeekdayIndexByEnglishName,
  setWeekStart,
} from './datetime/moment_wrapper';
export {
  InternalTimeZones,
  timeZoneFormatUserFriendly,
  getZone,
  type TimeZoneCountry,
  type TimeZoneInfo,
  type GroupedTimeZones,
  getTimeZoneInfo,
  getTimeZones,
  getTimeZoneGroups,
} from './datetime/timezones';
export {
  type SystemDateFormatSettings,
  SystemDateFormatsState,
  localTimeFormat,
  systemDateFormats,
} from './datetime/formats';
export {
  type DateTimeOptionsWithFormat,
  dateTimeFormat,
  dateTimeFormatISO,
  dateTimeFormatTimeAgo,
  dateTimeFormatWithAbbrevation,
  timeZoneAbbrevation,
} from './datetime/formatter';
export { type DateTimeOptionsWhenParsing, dateTimeParse } from './datetime/parser';
export {
  intervalToAbbreviatedDurationString,
  parseDuration,
  addDurationToDate,
  durationToMilliseconds,
  isValidDate,
  isValidDuration,
  isValidGoDuration,
  isValidGrafanaDuration,
} from './datetime/durationutil';

export {
  type ValueMatcherOptions,
  type BasicValueMatcherOptions,
  type RangeValueMatcherOptions,
} from './transformations/matchers/valueMatchers/types';
export { LayoutModes, type LayoutMode } from './types/layout';
export { PanelPlugin, type SetFieldConfigOptionsArgs, type StandardOptionConfig } from './panel/PanelPlugin';
export {
  getPanelOptionsWithDefaults,
  filterFieldConfigOverrides,
  restoreCustomOverrideRules,
  isCustomFieldProp,
  isStandardFieldProp,
  type OptionDefaults,
} from './panel/getPanelOptionsWithDefaults';
export { createFieldConfigRegistry } from './panel/registryFactories';
export { type QueryRunner, type QueryRunnerOptions } from './types/queryRunner';
export { type GroupingToMatrixTransformerOptions } from './transformations/transformers/groupingToMatrix';
export { type PluginContextType, type DataSourcePluginContextType } from './context/plugins/PluginContext';
export { type PluginContextProviderProps, PluginContextProvider } from './context/plugins/PluginContextProvider';
export {
  type DataSourcePluginContextProviderProps,
  DataSourcePluginContextProvider,
} from './context/plugins/DataSourcePluginContextProvider';
export { usePluginContext } from './context/plugins/usePluginContext';
export { isDataSourcePluginContext } from './context/plugins/guards';
export { getLinksSupplier } from './field/fieldOverrides';

// deprecated
export { CircularVector } from './vector/CircularVector';
export { vectorator } from './vector/FunctionalVector';
export { ArrayVector } from './vector/ArrayVector';
export { CircularDataFrame } from './dataframe/CircularDataFrame';
export {
  type CurrentUser,
  userHasPermission,
  userHasPermissionInMetadata,
  userHasAllPermissions,
  userHasAnyPermission,
} from './rbac/rbac';
