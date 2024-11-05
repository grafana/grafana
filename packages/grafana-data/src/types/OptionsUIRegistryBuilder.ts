import { ComponentType } from 'react';

import {
  NumberFieldConfigSettings,
  SelectFieldConfigSettings,
  SliderFieldConfigSettings,
  StringFieldConfigSettings,
} from '../field/overrides/processors';
import { RegistryItem, Registry } from '../utils/Registry';

import { OptionEditorConfig } from './options';

/**
 * Option editor registry item
 */
export interface OptionsEditorItem<TOptions, TSettings, TEditorProps, TValue>
  extends RegistryItem,
    OptionEditorConfig<TOptions, TSettings, TValue> {
  /**
   * React component used to edit the options property
   */
  editor: ComponentType<TEditorProps>;

  /*
   * @param value
   */
  getItemsCount?: (value?: TValue) => number;
}

/**
 * Describes an API for option editors UI builder
 */
interface OptionsUIRegistryBuilderAPI<
  TOptions,
  TEditorProps,
  T extends OptionsEditorItem<TOptions, any, TEditorProps, any>,
> {
  addNumberInput?<TSettings extends NumberFieldConfigSettings = NumberFieldConfigSettings>(
    config: OptionEditorConfig<TOptions, TSettings, number>
  ): this;

  addSliderInput?<TSettings extends SliderFieldConfigSettings = SliderFieldConfigSettings>(
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

  addBooleanSwitch?<TSettings>(config: OptionEditorConfig<TOptions, TSettings, boolean>): this;

  addUnitPicker?<TSettings>(config: OptionEditorConfig<TOptions, TSettings, string>): this;

  addColorPicker?<TSettings>(config: OptionEditorConfig<TOptions, TSettings, string>): this;

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
  T extends OptionsEditorItem<TOptions, any, TEditorProps, any>,
> implements OptionsUIRegistryBuilderAPI<TOptions, TEditorProps, T>
{
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

  getItems() {
    return this.properties;
  }
}
