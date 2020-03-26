import { ComponentType } from 'react';
import { RegistryItem, Registry } from '../utils/Registry';
import { NumberFieldConfigSettings, SelectFieldConfigSettings, StringFieldConfigSettings } from '../field';

/**
 * Option editor registry item
 */
interface OptionsEditorItem<TSettings, TEditorProps> extends RegistryItem {
  settings?: TSettings;
  editor?: ComponentType<TEditorProps>;
}

/**
 * Configuration of option editor registry item
 */
type OptionEditorConfig<TSettings, TEditorProps> = Pick<
  OptionsEditorItem<TSettings, TEditorProps>,
  'id' | 'name' | 'description' | 'editor' | 'settings'
>;

/**
 * Describes an API for option editors UI builder
 */
export interface OptionsUIRegistryBuilderAPI<TEditorProps, T extends OptionsEditorItem<any, TEditorProps>> {
  addNumberInput?<TSettings extends NumberFieldConfigSettings = NumberFieldConfigSettings>(
    config: OptionEditorConfig<TSettings, TEditorProps>
  ): this;

  addTextInput?<TSettings extends StringFieldConfigSettings = StringFieldConfigSettings>(
    config: OptionEditorConfig<TSettings, TEditorProps>
  ): this;

  addSelect?<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: OptionEditorConfig<TSettings, TEditorProps>
  ): this;

  addRadio?<TOption, TSettings extends SelectFieldConfigSettings<TOption> = SelectFieldConfigSettings<TOption>>(
    config: OptionEditorConfig<TSettings, TEditorProps>
  ): this;

  addBooleanSwitch?<TSettings = any>(config: OptionEditorConfig<TSettings, TEditorProps>): this;

  addUnitPicker?<TSettings = any>(config: OptionEditorConfig<TSettings, TEditorProps>): this;

  addColorPicker?<TSettings = any>(config: OptionEditorConfig<TSettings, TEditorProps>): this;

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
