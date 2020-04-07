import { ComponentType } from 'react';
import { RegistryItem, Registry } from '../utils/Registry';
import { NumberFieldConfigSettings, SelectFieldConfigSettings, StringFieldConfigSettings } from '../field';

/**
 * Option editor registry item
 */
export interface OptionsEditorItem<TOptions, TSettings, TEditorProps, TValue> extends RegistryItem {
  path: (keyof TOptions & string) | string;
  editor: ComponentType<TEditorProps>;
  settings?: TSettings;
  defaultValue?: TValue;
}

/**
 * Configuration of option editor registry item
 */
interface OptionEditorConfig<TOptions, TSettings, TValue = any> {
  id: keyof TOptions & string;
  name: string;
  description: string;
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
