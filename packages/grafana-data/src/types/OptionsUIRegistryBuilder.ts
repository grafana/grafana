import { ComponentType } from 'react';
import { RegistryItem, Registry } from '../utils/Registry';
import { NumberFieldConfigSettings, SelectFieldConfigSettings, StringFieldConfigSettings } from '../field';

/**
 * Option editor registry item
 */
export interface OptionsEditorItem<TOptions, TSettings, TEditorProps, TValue> extends RegistryItem {
  /**
   * Path of the options property to control.
   *
   * @example
   * Given options object of a type:
   * ```ts
   * interface CustomOptions {
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
   * React component used to edit the options property
   */
  editor: ComponentType<TEditorProps>;
  /**
   * Custom settings of the editor.
   */
  settings?: TSettings;
  /**
   * Array of strings representing category of the options property.
   */
  category?: string[];
  defaultValue?: TValue;
  /**
   * Function that enables configuration of when option editor should be shown based on current options properties.
   *
   * @param currentConfig Current options values
   */
  showIf?: (currentConfig: TOptions) => boolean | undefined;
  /**
   * Function that returns number of items if given option represents a collection, i.e. array of items.
   * @param value
   */
  getItemsCount?: (value?: TValue) => number;
}

/**
 * Configuration of option editor registry item
 */
interface OptionEditorConfig<TOptions, TSettings, TValue = any> {
  id: keyof TOptions & string;
  name: string;
  description?: string;
  settings?: TSettings;
  defaultValue?: TValue;
}

/**
 * Describes an API for option editors UI builder
 */
export interface OptionsUIRegistryBuilderAPI<
  TOptions,
  TEditorProps,
  T extends OptionsEditorItem<TOptions, any, TEditorProps, any>
> {
  addNumberInput?<TSettings extends NumberFieldConfigSettings = NumberFieldConfigSettings>(
    config: OptionEditorConfig<TOptions, TSettings, number>
  ): this;

  addTextInput?<TSettings extends StringFieldConfigSettings = StringFieldConfigSettings>(
    config: OptionEditorConfig<TOptions, TSettings, string>
  ): this;

  addStringArray?<TSettings extends StringFieldConfigSettings = StringFieldConfigSettings>(
    config: OptionEditorConfig<TOptions, TSettings, string[]>
  ): this;

  addSelect?<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: OptionEditorConfig<TOptions, TSettings, TOption>
  ): this;

  addRadio?<TOption, TSettings extends SelectFieldConfigSettings<TOption> = SelectFieldConfigSettings<TOption>>(
    config: OptionEditorConfig<TOptions, TSettings, TOption>
  ): this;

  addBooleanSwitch?<TSettings = any>(config: OptionEditorConfig<TOptions, TSettings, boolean>): this;

  addUnitPicker?<TSettings = any>(config: OptionEditorConfig<TOptions, TSettings, string>): this;

  addColorPicker?<TSettings = any>(config: OptionEditorConfig<TOptions, TSettings, string>): this;

  /**
   * Enables custom editor definition
   * @param config
   */
  addCustomEditor<TSettings, TValue>(config: OptionsEditorItem<TOptions, TSettings, TEditorProps, TValue>): this;

  /**
   * Returns registry of option editors
   */
  getRegistry: () => Registry<T>;
}

export abstract class OptionsUIRegistryBuilder<
  TOptions,
  TEditorProps,
  T extends OptionsEditorItem<TOptions, any, TEditorProps, any>
> implements OptionsUIRegistryBuilderAPI<TOptions, TEditorProps, T> {
  private properties: T[] = [];

  addCustomEditor<TSettings, TValue>(config: T & OptionsEditorItem<TOptions, TSettings, TEditorProps, TValue>): this {
    this.properties.push(config);
    return this;
  }

  getRegistry() {
    return new Registry(() => {
      return this.properties;
    });
  }
}
