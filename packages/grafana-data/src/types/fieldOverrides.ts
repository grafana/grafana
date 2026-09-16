import { type ComponentType } from 'react';

import { type FieldConfigOptionsRegistry } from '../field/FieldConfigOptionsRegistry';
import { type StandardEditorContext, type StandardEditorProps } from '../field/standardFieldConfigEditorRegistry';
import { type GrafanaTheme2 } from '../themes/types';

import { type OptionsEditorItem } from './OptionsUIRegistryBuilder';
import { type ScopedVars } from './ScopedVars';
import { type DataFrame, type Field, type FieldConfig, type ValueLinkConfig } from './dataFrame';
import { type DataLink, type LinkModel } from './dataLink';
import { type OptionEditorConfig } from './options';
import { type InterpolateFunction } from './panel';
import { type TimeZone } from './time';
import { type MatcherConfig } from './transformations';

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
    return '__systemRef' in override && override.__systemRef === ref;
  };
}

/**
 * Guard functionality to check if an override rule is of type {@link SystemConfigOverrideRule}.
 * It will return true if the {@link SystemConfigOverrideRule} has any systemRef set.
 *
 * @internal
 */
export const isSystemOverride = (override: ConfigOverrideRule): override is SystemConfigOverrideRule => {
  return '__systemRef' in override && typeof override.__systemRef === 'string';
};

export interface FieldConfigSource<TOptions = any> {
  // Defaults applied to all numeric fields
  defaults: FieldConfig<TOptions>;

  // Rules to override individual values
  overrides: ConfigOverrideRule[];
}

export interface FieldOverrideContext extends StandardEditorContext<any> {
  field?: Field;
  dataFrameIndex?: number; // The index for the selected field frame
}

/** @deprecated Use StandardEditorProps instead */
export type FieldConfigEditorProps<TValue, TSettings extends {}> = StandardEditorProps<TValue, TSettings>;

/** @deprecated Use StandardEditorProps instead */
export type FieldOverrideEditorProps<TValue, TSettings extends {}> = StandardEditorProps<TValue, TSettings>;

export interface FieldConfigEditorConfig<TOptions, TSettings = any, TValue = any, TContextOptions = unknown>
  extends OptionEditorConfig<TOptions, TSettings, TValue, TContextOptions> {
  /**
   * Function that allows specifying whether or not this field config should apply to a given field.
   * @param field
   */
  shouldApply?: (field: Field) => boolean;

  /** Indicates that option shoukd not be available in the Field config tab */
  hideFromDefaults?: boolean;

  /** Indicates that option should not be available for the overrides */
  hideFromOverrides?: boolean;

  /**
   * Controls whether this option is offered in the "Add override property" picker, based on the
   * override editor context. Distinct from `showIf`, which is evaluated against the *default*
   * field config and so cannot decide what a per-field override may set.
   * Use `hideFromOverrides` when the picker must never show the property.
   *
   * Return `false` to hide the option, `true` to offer it. The return type deliberately excludes
   * `undefined`, unlike `showIf`, so a predicate cannot fall off the end and hide the option by
   * accident. At runtime only an explicit `false` hides, so an untyped plugin that returns nothing
   * still has the option offered.
   *
   * Use `context.options` to decide if the picker shows this property. `context.fieldConfig`
   * contains the full field configuration for editors that need it. Do not use default field
   * configuration values here because an override rule can change those values. `context.data`
   * contains data for the matcher scope, but it does not contain data filtered by the matcher.
   *
   * @example
   * `context.options` is typed from the second generic of `SetFieldConfigOptionsArgs`, which
   * `useFieldConfig` fills in from the panel's own options type. A field config built in a helper
   * has to pass that generic through, or `context.options` stays `unknown`:
   * ```ts
   * function getMyFieldConfig(): SetFieldConfigOptionsArgs<MyFieldConfig, MyPanelOptions> {
   *   return {
   *     useCustomConfig: (builder) => {
   *       builder.addSliderInput({
   *         path: 'lineWidth',
   *         name: 'Line width',
   *         showIfOverride: (context) => context.options?.layout !== 'bars',
   *       });
   *     },
   *   };
   * }
   * ```
   */
  showIfOverride?(context: StandardEditorContext<TContextOptions>): boolean;
}

export interface FieldConfigPropertyItem<
  TOptions = any,
  TValue = any,
  TSettings extends {} = any,
  TContextOptions = unknown,
> extends OptionsEditorItem<TOptions, TSettings, StandardEditorProps<TValue, TSettings>, TValue, TContextOptions> {
  // An editor that can be filled in with context info (template variables etc)
  override: ComponentType<StandardEditorProps<TValue, TSettings>>;

  /** true for plugin field config properties */
  isCustom?: boolean;

  /** Hides option from the Field config tab */
  hideFromDefaults?: boolean;

  /** Indicates that option should not be available for the overrides */
  hideFromOverrides?: boolean;

  /**
   * Controls whether this option is offered in the "Add override property" picker, based on the
   * override editor context. Returning `false` only removes it from the picker - a rule that
   * already sets the property still renders and keeps its value. Only an explicit `false` hides.
   */
  showIfOverride?(context: StandardEditorContext<TContextOptions>): boolean;

  /** Convert the override value to a well typed value */
  process: (value: any, context: FieldOverrideContext, settings?: TSettings) => TValue | undefined | null;

  /** Checks if field should be processed */
  shouldApply: (field: Field) => boolean;
}

export type DataLinkPostProcessorOptions = {
  frame: DataFrame;
  field: Field;
  dataLinkScopedVars: ScopedVars;
  replaceVariables: InterpolateFunction;
  timeZone?: TimeZone;
  config: ValueLinkConfig;
  link: DataLink;
  linkModel: LinkModel;
};

export type DataLinkPostProcessor = (options: DataLinkPostProcessorOptions) => LinkModel<Field> | undefined;

export interface ApplyFieldOverrideOptions {
  data?: DataFrame[];
  fieldConfig: FieldConfigSource;
  fieldConfigRegistry?: FieldConfigOptionsRegistry;
  replaceVariables: InterpolateFunction;
  theme: GrafanaTheme2;
  timeZone?: TimeZone;
  dataLinkPostProcessor?: DataLinkPostProcessor;
}

export enum FieldConfigProperty {
  Unit = 'unit',
  Min = 'min',
  Max = 'max',
  FieldMinMax = 'fieldMinMax',
  Decimals = 'decimals',
  DisplayName = 'displayName',
  NoValue = 'noValue',
  Thresholds = 'thresholds',
  Mappings = 'mappings',
  Links = 'links',
  Actions = 'actions',
  Color = 'color',
  Filterable = 'filterable',
}
