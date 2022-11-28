import { ComponentType } from 'react';

import { StandardEditorProps, FieldConfigOptionsRegistry, StandardEditorContext } from '../field';
import { GrafanaTheme2 } from '../themes';
import { MatcherConfig, FieldConfig, Field, DataFrame, TimeZone } from '../types';

import { OptionsEditorItem } from './OptionsUIRegistryBuilder';
import { OptionEditorConfig } from './options';
import { InterpolateFunction } from './panel';

export interface DynamicConfigValue {
  id: string;
  value?: any;
}

export interface ConfigOverrideRule {
  matcher: MatcherConfig;
  properties: DynamicConfigValue[];
}

/**
 * Describes config override rules created when interacting with Grafana.
 *
 * @internal
 */
export interface SystemConfigOverrideRule extends ConfigOverrideRule {
  __systemRef: string;
}

/**
 * Guard functionality to check if an override rule is of type {@link SystemConfigOverrideRule}.
 * It will only return true if the {@link SystemConfigOverrideRule} has the passed systemRef.
 *
 * @param ref system override reference
 * @internal
 */
export function isSystemOverrideWithRef<T extends SystemConfigOverrideRule>(ref: string) {
  return (override: ConfigOverrideRule): override is T => {
    const overrideAs = override as T;
    return overrideAs.__systemRef === ref;
  };
}

/**
 * Guard functionality to check if an override rule is of type {@link SystemConfigOverrideRule}.
 * It will return true if the {@link SystemConfigOverrideRule} has any systemRef set.
 *
 * @internal
 */
export const isSystemOverride = (override: ConfigOverrideRule): override is SystemConfigOverrideRule => {
  return typeof (override as SystemConfigOverrideRule)?.__systemRef === 'string';
};

export interface FieldConfigSource<TOptions = any> {
  // Defaults applied to all numeric fields
  defaults: FieldConfig<TOptions>;

  // Rules to override individual values
  overrides: ConfigOverrideRule[];
}

export interface FieldOverrideContext extends StandardEditorContext<any, any> {
  field?: Field;
  dataFrameIndex?: number; // The index for the selected field frame
}
export interface FieldConfigEditorProps<TValue, TSettings extends {}>
  extends Omit<StandardEditorProps<TValue, TSettings>, 'item'> {
  item: FieldConfigPropertyItem<any, TValue, TSettings>; // The property info
  value: TValue;
  context: FieldOverrideContext;
  onChange: (value?: TValue) => void;
}

export interface FieldOverrideEditorProps<TValue, TSettings> extends Omit<StandardEditorProps<TValue>, 'item'> {
  item: FieldConfigPropertyItem<TValue, TSettings>;
  context: FieldOverrideContext;
}

export interface FieldConfigEditorConfig<TOptions, TSettings = any, TValue = any>
  extends OptionEditorConfig<TOptions, TSettings, TValue> {
  /**
   * Function that allows specifying whether or not this field config should apply to a given field.
   * @param field
   */
  shouldApply?: (field: Field) => boolean;

  /** Indicates that option shoukd not be available in the Field config tab */
  hideFromDefaults?: boolean;

  /** Indicates that option should not be available for the overrides */
  hideFromOverrides?: boolean;
}

export interface FieldConfigPropertyItem<TOptions = any, TValue = any, TSettings extends {} = any>
  extends OptionsEditorItem<TOptions, TSettings, FieldConfigEditorProps<TValue, TSettings>, TValue> {
  // An editor that can be filled in with context info (template variables etc)
  override: ComponentType<FieldOverrideEditorProps<TValue, TSettings>>;

  /** true for plugin field config properties */
  isCustom?: boolean;

  /** Hides option from the Field config tab */
  hideFromDefaults?: boolean;

  /** Indicates that option should not be available for the overrides */
  hideFromOverrides?: boolean;

  /** Convert the override value to a well typed value */
  process: (value: any, context: FieldOverrideContext, settings?: TSettings) => TValue | undefined | null;

  /** Checks if field should be processed */
  shouldApply: (field: Field) => boolean;
}

export interface ApplyFieldOverrideOptions {
  data?: DataFrame[];
  fieldConfig: FieldConfigSource;
  fieldConfigRegistry?: FieldConfigOptionsRegistry;
  replaceVariables: InterpolateFunction;
  theme: GrafanaTheme2;
  timeZone?: TimeZone;
}

export enum FieldConfigProperty {
  Unit = 'unit',
  Min = 'min',
  Max = 'max',
  Decimals = 'decimals',
  DisplayName = 'displayName',
  NoValue = 'noValue',
  Thresholds = 'thresholds',
  Mappings = 'mappings',
  Links = 'links',
  Color = 'color',
}
