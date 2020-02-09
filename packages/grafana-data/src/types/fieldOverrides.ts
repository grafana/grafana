import { MatcherConfig, FieldConfig, Field } from '../types';
import { Registry, RegistryItem } from '../utils';
import { ComponentType } from 'react';
import { InterpolateFunction } from './panel';
import { DataFrame } from 'apache-arrow';

export interface DynamicConfigValue {
  name: string;
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
  onChange: (value?: TValue) => void;
}

export interface FieldOverrideContext {
  field: Field;
  data: DataFrame;
  replaceVariables: InterpolateFunction;
}

export interface FieldOverrideEditorProps<TValue, TSettings> {
  item: FieldPropertyEditorItem<TValue, TSettings>;
  value: any;
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
