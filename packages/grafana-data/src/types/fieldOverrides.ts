import { ComponentType } from 'react';
import { MatcherConfig, FieldConfig, Field, DataFrame, VariableSuggestion, VariableSuggestionsScope } from '../types';
import { Registry, RegistryItem } from '../utils';
import { InterpolateFunction } from './panel';

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

export interface FieldConfigEditorProps<TValue, TSettings> {
  item: FieldPropertyEditorItem<TValue, TSettings>; // The property info
  value: TValue;
  context: FieldOverrideContext;
  onChange: (value?: TValue) => void;
}

export interface FieldOverrideContext {
  data: DataFrame[];
  field?: Field;
  replaceVariables?: InterpolateFunction;
  getSuggestions?: (scope?: VariableSuggestionsScope) => VariableSuggestion[];
}

export interface FieldOverrideEditorProps<TValue, TSettings> {
  item: FieldPropertyEditorItem<TValue, TSettings>;
  value: TValue;
  context: FieldOverrideContext;
  onChange: (value?: any) => void;
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
}

export type FieldConfigEditorRegistry = Registry<FieldPropertyEditorItem>;
