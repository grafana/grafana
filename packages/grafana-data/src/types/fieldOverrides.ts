import { ComponentType } from 'react';
import {
  MatcherConfig,
  FieldConfig,
  Field,
  DataFrame,
  VariableSuggestionsScope,
  VariableSuggestion,
  GrafanaTheme,
  TimeZone,
} from '../types';
import { Registry, RegistryItem } from '../utils';
import { InterpolateFunction } from './panel';
import { StandardEditorProps } from '../field';

export interface DynamicConfigValue {
  prop: string;
  value?: any;
  custom?: boolean;
}

export interface ConfigOverrideRule {
  matcher: MatcherConfig;
  properties: DynamicConfigValue[];
}

export interface FieldConfigSource {
  // Defatuls applied to all numeric fields
  defaults: FieldConfig;

  // Rules to override individual values
  overrides: ConfigOverrideRule[];
}

export interface FieldOverrideContext {
  field?: Field;
  dataFrameIndex?: number; // The index for the selected field frame
  data: DataFrame[]; // All results
  replaceVariables?: InterpolateFunction;
  getSuggestions?: (scope?: VariableSuggestionsScope) => VariableSuggestion[];
}

export interface FieldConfigEditorProps<TValue, TSettings>
  extends Omit<StandardEditorProps<TValue, TSettings>, 'item'> {
  item: FieldPropertyEditorItem<TValue, TSettings>; // The property info
  value: TValue;
  context: FieldOverrideContext;
  onChange: (value?: TValue) => void;
}

export interface FieldOverrideEditorProps<TValue, TSettings> extends Omit<StandardEditorProps<TValue>, 'item'> {
  item: FieldPropertyEditorItem<TValue, TSettings>;
  context: FieldOverrideContext;
}

export interface FieldConfigEditorConfig<TSettings = any, TValue = any>
  extends Omit<Pick<FieldPropertyEditorItem<TValue, TSettings>, 'id' | 'description' | 'name'>, 'settings'> {
  settings?: TSettings;
  shouldApply?: (field: Field) => boolean;
}

export interface FieldPropertyEditorItem<TValue = any, TSettings = any> extends RegistryItem {
  // An editor the creates the well typed value
  editor: ComponentType<FieldConfigEditorProps<TValue, TSettings>>;

  // An editor that can be filled in with context info (template variables etc)
  override: ComponentType<FieldOverrideEditorProps<TValue, TSettings>>;

  // Convert the override value to a well typed value
  process: (value: any, context: FieldOverrideContext, settings: TSettings) => TValue;

  // Configuration options for the particular property
  settings: TSettings;

  // Checks if field should be processed
  shouldApply: (field: Field) => boolean;
}

export type FieldConfigEditorRegistry = Registry<FieldPropertyEditorItem>;

export interface ApplyFieldOverrideOptions {
  data?: DataFrame[];
  fieldOptions: FieldConfigSource;
  replaceVariables: InterpolateFunction;
  theme: GrafanaTheme;
  timeZone?: TimeZone;
  autoMinMax?: boolean;
  standard?: FieldConfigEditorRegistry;
  custom?: FieldConfigEditorRegistry;
}
