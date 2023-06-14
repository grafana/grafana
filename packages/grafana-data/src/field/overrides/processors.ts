import {
  DataLink,
  Field,
  FieldOverrideContext,
  SelectableValue,
  SliderMarks,
  ThresholdsConfig,
  ValueMapping,
} from '../../types';

export const identityOverrideProcessor = <T>(value: T, _context: FieldOverrideContext, _settings: any) => {
  return value;
};

export interface NumberFieldConfigSettings {
  placeholder?: string;
  integer?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export const numberOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings?: NumberFieldConfigSettings
) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return parseFloat(value);
};

export const displayNameOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings?: StringFieldConfigSettings
) => {
  // clear the cached display name
  delete context.field?.state?.displayName;
  return stringOverrideProcessor(value, context, settings);
};

export interface SliderFieldConfigSettings {
  min: number;
  max: number;
  step?: number;
  included?: boolean;
  marks?: SliderMarks;
  ariaLabelForHandle?: string;
}

export interface DataLinksFieldConfigSettings {}

export const dataLinksOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings?: DataLinksFieldConfigSettings
) => {
  return value as DataLink[];
};

export interface ValueMappingFieldConfigSettings {}

export const valueMappingsOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings?: ValueMappingFieldConfigSettings
) => {
  return value as ValueMapping[]; // !!!! likely not !!!!
};

export interface SelectFieldConfigSettings<T> {
  allowCustomValue?: boolean;

  isClearable?: boolean;

  /** The default options */
  options: Array<SelectableValue<T>>;

  /** Optionally use the context to define the options */
  getOptions?: (context: FieldOverrideContext) => Promise<Array<SelectableValue<T>>>;
}

export const selectOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings?: SelectFieldConfigSettings<any>
) => {
  return value;
};

export interface StringFieldConfigSettings {
  placeholder?: string;
  maxLength?: number;
  expandTemplateVars?: boolean;
  useTextarea?: boolean;
  rows?: number;
}

export const stringOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings?: StringFieldConfigSettings
) => {
  if (value === null || value === undefined) {
    return value;
  }
  if (settings && settings.expandTemplateVars && context.replaceVariables) {
    return context.replaceVariables(value, context.field!.state!.scopedVars);
  }
  return `${value}`;
};

export interface ThresholdsFieldConfigSettings {
  // Anything?
}

export const thresholdsOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings?: ThresholdsFieldConfigSettings
) => {
  return value as ThresholdsConfig; // !!!! likely not !!!!
};

export interface UnitFieldConfigSettings {
  isClearable?: boolean;
}

export const unitOverrideProcessor = (
  value: boolean,
  _context: FieldOverrideContext,
  _settings?: UnitFieldConfigSettings
) => {
  return value;
};

export const booleanOverrideProcessor = (
  value: boolean,
  _context: FieldOverrideContext,
  _settings?: ThresholdsFieldConfigSettings
) => {
  return value; // !!!! likely not !!!!
};

export interface FieldColorConfigSettings {
  /**
   * When switching to a visualization that does not support by value coloring then Grafana will
   * switch to a by series palette based color mode
   */
  byValueSupport?: boolean;
  /**
   * When switching to a visualization that has this set to true then Grafana will change color mode
   * to from thresholds if it was set to a by series palette
   */
  preferThresholdsMode?: boolean;
  /**
   * Set to true if the visualization supports both by value and by series
   * This will enable the Color by series UI option that sets the `color.seriesBy` option.
   */
  bySeriesSupport?: boolean;
}

export interface StatsPickerConfigSettings {
  /**
   * Enable multi-selection in the stats picker
   */
  allowMultiple: boolean;
  /**
   * Default stats to be use in the stats picker
   */
  defaultStat?: string;
}

export interface FieldNamePickerConfigSettings {
  /**
   * Function is a predicate, to test each element of the array.
   * Return a value that coerces to true to keep the field, or to false otherwise.
   */
  filter?: (field: Field) => boolean;

  /**
   * Show this text when no values are found
   */
  noFieldsMessage?: string;

  /**addFieldNamePicker
   * Sets the width to a pixel value.
   */
  width?: number;

  /**
   * Placeholder text to display when nothing is selected.
   */
  placeholderText?: string;

  /** When set to false, the value can not be removed */
  isClearable?: boolean;
}
