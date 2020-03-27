import { ComponentType } from 'react';
import { RegistryItem, Registry } from '../utils/Registry';
import { NumberFieldConfigSettings, SelectFieldConfigSettings, StringFieldConfigSettings } from '../field';

/**
 * Option editor registry item
 */
export interface OptionsEditorItem<TSettings, TEditorProps> extends RegistryItem {
  editor: ComponentType<TEditorProps>;
  settings?: TSettings;
}

/**
 * Configuration of option editor registry item
 */
interface OptionEditorConfig<TSettings> {
  id: string;
  name: string;
  description: string;
  settings?: TSettings;
}

/**
 * Describes an API for option editors UI builder
 */
export interface OptionsUIRegistryBuilderAPI<TEditorProps, T extends OptionsEditorItem<any, TEditorProps>> {
  addNumberInput?<TSettings extends NumberFieldConfigSettings = NumberFieldConfigSettings>(
    config: OptionEditorConfig<TSettings>
  ): this;

  addTextInput?<TSettings extends StringFieldConfigSettings = StringFieldConfigSettings>(
    config: OptionEditorConfig<TSettings>
  ): this;

  addSelect?<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: OptionEditorConfig<TSettings>
  ): this;

  addRadio?<TOption, TSettings extends SelectFieldConfigSettings<TOption> = SelectFieldConfigSettings<TOption>>(
    config: OptionEditorConfig<TSettings>
  ): this;

  addBooleanSwitch?<TSettings = any>(config: OptionEditorConfig<TSettings>): this;

  addUnitPicker?<TSettings = any>(config: OptionEditorConfig<TSettings>): this;

  addColorPicker?<TSettings = any>(config: OptionEditorConfig<TSettings>): this;

  /**
   * Enables custom editor definition
   * @param config
   */
  addCustomEditor<TSettings>(config: OptionsEditorItem<TSettings, TEditorProps>): this;

  /**
   * Returns registry of option editors
   */
  getRegistry: () => Registry<T>;
}

export abstract class OptionsUIRegistryBuilder<TEditorProps, T extends OptionsEditorItem<any, TEditorProps>>
  implements OptionsUIRegistryBuilderAPI<TEditorProps, T> {
  private properties: T[] = [];

  addCustomEditor<TValue>(config: T & OptionsEditorItem<TValue, TEditorProps>): this {
    this.properties.push(config);
    return this;
  }

  getRegistry() {
    return new Registry(() => {
      return this.properties;
    });
  }
}
