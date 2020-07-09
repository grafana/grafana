import { FieldConfigEditorProps, FieldConfigPropertyItem, FieldConfigEditorConfig } from '../types/fieldOverrides';
import { OptionsUIRegistryBuilder } from '../types/OptionsUIRegistryBuilder';
import { FieldType } from '../types/dataFrame';
import { PanelOptionsEditorConfig, PanelOptionsEditorItem } from '../types/panel';
import {
  numberOverrideProcessor,
  selectOverrideProcessor,
  stringOverrideProcessor,
  booleanOverrideProcessor,
  standardEditorsRegistry,
  SelectFieldConfigSettings,
  StandardEditorProps,
  StringFieldConfigSettings,
  NumberFieldConfigSettings,
  ColorFieldConfigSettings,
  identityOverrideProcessor,
  UnitFieldConfigSettings,
  unitOverrideProcessor,
} from '../field';

/**
 * Fluent API for declarative creation of field config option editors
 */
export class FieldConfigEditorBuilder<TOptions> extends OptionsUIRegistryBuilder<
  TOptions,
  FieldConfigEditorProps<any, any>,
  FieldConfigPropertyItem<TOptions>
> {
  addNumberInput<TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings & NumberFieldConfigSettings, number>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      override: standardEditorsRegistry.get('number').editor as any,
      editor: standardEditorsRegistry.get('number').editor as any,
      process: numberOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : field => field.type === FieldType.number,
      settings: config.settings || {},
    });
  }

  addTextInput<TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings & StringFieldConfigSettings, string>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      override: standardEditorsRegistry.get('text').editor as any,
      editor: standardEditorsRegistry.get('text').editor as any,
      process: stringOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : field => field.type === FieldType.string,
      settings: config.settings || {},
    });
  }

  addSelect<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: FieldConfigEditorConfig<TOptions, TSettings, TOption>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      override: standardEditorsRegistry.get('select').editor as any,
      editor: standardEditorsRegistry.get('select').editor as any,
      process: selectOverrideProcessor,
      // ???
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || { options: [] },
    });
  }

  addRadio<TOption, TSettings = any>(config: FieldConfigEditorConfig<TOptions, TSettings, TOption>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      override: standardEditorsRegistry.get('radio').editor as any,
      editor: standardEditorsRegistry.get('radio').editor as any,
      process: selectOverrideProcessor,
      // ???
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || { options: [] },
    });
  }

  addBooleanSwitch<TSettings = any>(config: FieldConfigEditorConfig<TOptions, TSettings, boolean>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('boolean').editor as any,
      override: standardEditorsRegistry.get('boolean').editor as any,
      process: booleanOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }

  addColorPicker<TSettings = any>(
    config: FieldConfigEditorConfig<TOptions, TSettings & ColorFieldConfigSettings, string>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('color').editor as any,
      override: standardEditorsRegistry.get('color').editor as any,
      process: identityOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }

  addUnitPicker<TSettings = any>(
    config: FieldConfigEditorConfig<TOptions, TSettings & UnitFieldConfigSettings, string>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('unit').editor as any,
      override: standardEditorsRegistry.get('unit').editor as any,
      process: unitOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }
}

/**
 * Fluent API for declarative creation of panel options
 */
export class PanelOptionsEditorBuilder<TOptions> extends OptionsUIRegistryBuilder<
  TOptions,
  StandardEditorProps,
  PanelOptionsEditorItem<TOptions>
> {
  addNumberInput<TSettings>(config: PanelOptionsEditorConfig<TOptions, TSettings & NumberFieldConfigSettings, number>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('number').editor as any,
    });
  }

  addTextInput<TSettings>(config: PanelOptionsEditorConfig<TOptions, TSettings & StringFieldConfigSettings, string>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('text').editor as any,
    });
  }

  addStringArray<TSettings>(
    config: PanelOptionsEditorConfig<TOptions, TSettings & StringFieldConfigSettings, string[]>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('strings').editor as any,
    });
  }

  addSelect<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: PanelOptionsEditorConfig<TOptions, TSettings, TOption>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('select').editor as any,
    });
  }

  addRadio<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: PanelOptionsEditorConfig<TOptions, TSettings, TOption>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('radio').editor as any,
    });
  }

  addBooleanSwitch<TSettings = any>(config: PanelOptionsEditorConfig<TOptions, TSettings, boolean>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('boolean').editor as any,
    });
  }

  addColorPicker<TSettings = any>(
    config: PanelOptionsEditorConfig<TOptions, TSettings & ColorFieldConfigSettings, string>
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('color').editor as any,
      settings: config.settings || {},
    });
  }

  addTimeZonePicker<TSettings = any>(config: PanelOptionsEditorConfig<TOptions, TSettings, string>): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('timezone').editor as any,
      settings: config.settings || {},
    });
  }

  addUnitPicker<TSettings = any>(
    config: PanelOptionsEditorConfig<TOptions, TSettings & UnitFieldConfigSettings, string>
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('unit').editor as any,
    });
  }
}
