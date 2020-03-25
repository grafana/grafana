import { DataLink, FieldOverrideContext, SelectableValue, ThresholdsConfig, ValueMapping } from '../../types';

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
  settings: NumberFieldConfigSettings
) => {
  const v = parseFloat(`${value}`);
  if (settings.max && v > settings.max) {
    // ????
  }
  return v;
};

export interface DataLinksFieldConfigSettings {}

export const dataLinksOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings: DataLinksFieldConfigSettings
) => {
  return value as DataLink[];
};

export interface ValueMappingFieldConfigSettings {}

export const valueMappingsOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings: ValueMappingFieldConfigSettings
) => {
  return value as ValueMapping[]; // !!!! likely not !!!!
};

export interface SelectFieldConfigSettings<T> {
  options: Array<SelectableValue<T>>;
}

export const selectOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings: SelectFieldConfigSettings<any>
) => {
  return value;
};

export interface StringFieldConfigSettings {
  placeholder?: string;
  maxLength?: number;
  expandTemplateVars?: boolean;
}

export const stringOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings: StringFieldConfigSettings
) => {
  if (settings.expandTemplateVars && context.replaceVariables) {
    return context.replaceVariables(value, context.field!.config.scopedVars);
  }
  return `${value}`;
};

export interface ThresholdsFieldConfigSettings {
  // Anything?
}

export const thresholdsOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings: ThresholdsFieldConfigSettings
) => {
  return value as ThresholdsConfig; // !!!! likely not !!!!
};

export interface UnitFieldConfigSettings {}

export const unitOverrideProcessor = (
  value: boolean,
  _context: FieldOverrideContext,
  _settings: UnitFieldConfigSettings
) => {
  return value;
};

export const booleanOverrideProcessor = (
  value: boolean,
  _context: FieldOverrideContext,
  _settings: ThresholdsFieldConfigSettings
) => {
  return value; // !!!! likely not !!!!
};

export interface ColorFieldConfigSettings {
  enableNamedColors?: boolean;
}
