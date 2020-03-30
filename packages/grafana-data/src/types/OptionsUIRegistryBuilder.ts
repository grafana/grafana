import { ComponentType } from 'react';
import { RegistryItem, Registry } from '../utils/Registry';
import { NumberFieldConfigSettings, SelectFieldConfigSettings, StringFieldConfigSettings } from '../field';

/**
 * Option editor registry item
 */
export interface OptionsEditorItem<TOptions, TSettings, TEditorProps> extends RegistryItem {
  id: (keyof TOptions & string) | string;
  editor: ComponentType<TEditorProps>;
  settings?: TSettings;
}

/**
 * Configuration of option editor registry item
 */
interface OptionEditorConfig<TOptions, TSettings> {
  id: keyof TOptions & string;
  name: string;
  description: string;
  settings?: TSettings;
}

/**
 * Describes an API for option editors UI builder
 */
export interface OptionsUIRegistryBuilderAPI<
  TOptions,
  TEditorProps,
  T extends OptionsEditorItem<TOptions, any, TEditorProps>
> {
  addNumberInput?<TSettings extends NumberFieldConfigSettings = NumberFieldConfigSettings>(
    config: OptionEditorConfig<TOptions, TSettings>
  ): this;

  addTextInput?<TSettings extends StringFieldConfigSettings = StringFieldConfigSettings>(
    config: OptionEditorConfig<TOptions, TSettings>
  ): this;

  addSelect?<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: OptionEditorConfig<TOptions, TSettings>
  ): this;

  addRadio?<TOption, TSettings extends SelectFieldConfigSettings<TOption> = SelectFieldConfigSettings<TOption>>(
    config: OptionEditorConfig<TOptions, TSettings>
  ): this;

  addBooleanSwitch?<TSettings = any>(config: OptionEditorConfig<TOptions, TSettings>): this;

  addUnitPicker?<TSettings = any>(config: OptionEditorConfig<TOptions, TSettings>): this;

  addColorPicker?<TSettings = any>(config: OptionEditorConfig<TOptions, TSettings>): this;

  /**
   * Enables custom editor definition
   * @param config
   */
  addCustomEditor<TSettings>(config: OptionsEditorItem<TOptions, TSettings, TEditorProps>): this;

  /**
   * Returns registry of option editors
   */
  getRegistry: () => Registry<T>;
}

export abstract class OptionsUIRegistryBuilder<
  TOptions,
  TEditorProps,
  T extends OptionsEditorItem<TOptions, any, TEditorProps>
> implements OptionsUIRegistryBuilderAPI<TOptions, TEditorProps, T> {
  private properties: T[] = [];

  addCustomEditor<TValue>(config: T & OptionsEditorItem<TOptions, TValue, TEditorProps>): this {
    this.properties.push(config);
    return this;
  }

  getRegistry() {
    return new Registry(() => {
      return this.properties;
    });
  }
}
