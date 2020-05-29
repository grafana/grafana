import { ComponentType } from 'react';
import { MatcherConfig, FieldConfig, Field, DataFrame, GrafanaTheme, TimeZone } from '../types';
import { InterpolateFunction } from './panel';
import { StandardEditorProps, FieldConfigOptionsRegistry, StandardEditorContext } from '../field';
import { OptionsEditorItem } from './OptionsUIRegistryBuilder';

export interface DynamicConfigValue {
  id: string;
  value?: any;
}

export interface ConfigOverrideRule {
  matcher: MatcherConfig;
  properties: DynamicConfigValue[];
}

export interface FieldConfigSource<TOptions extends object = any> {
  // Defatuls applied to all numeric fields
  defaults: FieldConfig<TOptions>;

  // Rules to override individual values
  overrides: ConfigOverrideRule[];
}

export interface FieldOverrideContext extends StandardEditorContext {
  field?: Field;
  dataFrameIndex?: number; // The index for the selected field frame
  data: DataFrame[]; // All results
}
export interface FieldConfigEditorProps<TValue, TSettings>
  extends Omit<StandardEditorProps<TValue, TSettings>, 'item'> {
  item: FieldConfigPropertyItem<TValue, TSettings>; // The property info
  value: TValue;
  context: FieldOverrideContext;
  onChange: (value?: TValue) => void;
}

export interface FieldOverrideEditorProps<TValue, TSettings> extends Omit<StandardEditorProps<TValue>, 'item'> {
  item: FieldConfigPropertyItem<TValue, TSettings>;
  context: FieldOverrideContext;
}

export interface FieldConfigEditorConfig<TOptions, TSettings = any, TValue = any> {
  /**
   * Path of the field config property to control.
   *
   * @example
   * Given field config object of a type:
   * ```ts
   * interface CustomFieldConfig {
   *   a: {
   *     b: string;
   *   }
   * }
   * ```
   *
   * path can be either 'a' or 'a.b'.
   */
  path: (keyof TOptions & string) | string;
  /**
   * Name of the field config property. Will be displayed in the UI as form element label.
   */
  name: string;
  /**
   * Description of the field config property. Will be displayed in the UI as form element description.
   */
  description?: string;
  /**
   * Array of strings representing category of the field config property. First element in the array will make option render as collapsible section.
   */
  category?: string[];
  /**
   * Custom settings of the editor.
   */
  settings?: TSettings;
  /**
   * Function that allows specifying whether or not this field config should apply to a given field.
   * @param field
   */
  shouldApply?: (field: Field) => boolean;
  defaultValue?: TValue;
  /**
   * Function that enables configuration of when field config property editor should be shown based on current panel field config.
   *
   * @param currentConfig Current field config values
   */
  showIf?: (currentConfig: TOptions) => boolean;
}

export interface FieldConfigPropertyItem<TOptions = any, TValue = any, TSettings extends {} = any>
  extends OptionsEditorItem<TOptions, TSettings, FieldConfigEditorProps<TValue, TSettings>, TValue> {
  // An editor that can be filled in with context info (template variables etc)
  override: ComponentType<FieldOverrideEditorProps<TValue, TSettings>>;

  /** true for plugin field config properties */
  isCustom?: boolean;

  // Convert the override value to a well typed value
  process: (value: any, context: FieldOverrideContext, settings?: TSettings) => TValue | undefined | null;

  // Checks if field should be processed
  shouldApply: (field: Field) => boolean;
}

export interface ApplyFieldOverrideOptions {
  data?: DataFrame[];
  fieldConfig: FieldConfigSource;
  replaceVariables: InterpolateFunction;
  theme: GrafanaTheme;
  timeZone?: TimeZone;
  autoMinMax?: boolean;
  fieldConfigRegistry?: FieldConfigOptionsRegistry;
}

export enum FieldConfigProperty {
  Unit = 'unit',
  Min = 'min',
  Max = 'max',
  Decimals = 'decimals',
  Title = 'title',
  NoValue = 'noValue',
  Thresholds = 'thresholds',
  Mappings = 'mappings',
  Links = 'links',
  Color = 'color',
}
