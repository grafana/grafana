/**
 * A library containing most of the core functionality and data types used in Grafana.
 *
 * @packageDocumentation
 */
export * from './utils';
export * from './types';
export * from './transformations';
export * from './datetime';
export * from './text';
export * from './valueFormats';
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
export * from './dataframe/CircularDataFrame';
export {
  type CurrentUser,
  userHasPermission,
  userHasPermissionInMetadata,
  userHasAllPermissions,
  userHasAnyPermission,
} from './rbac/rbac';
