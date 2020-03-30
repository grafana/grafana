import {
  FieldType,
  FieldConfigEditorProps,
  FieldPropertyEditorItem,
  PanelOptionsEditorConfig,
  PanelOptionsEditorItem,
  FieldConfigEditorConfig,
} from '../types';
import { OptionsUIRegistryBuilder } from '../types/OptionsUIRegistryBuilder';
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
export class FieldConfigEditorBuilder extends OptionsUIRegistryBuilder<
  FieldConfigEditorProps<any, any>,
  FieldPropertyEditorItem
> {
  addNumberInput<TSettings>(config: FieldConfigEditorConfig<TSettings & NumberFieldConfigSettings>) {
    return this.addCustomEditor({
      ...config,
      override: standardEditorsRegistry.get('number').editor as any,
      editor: standardEditorsRegistry.get('number').editor as any,
      process: numberOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : field => field.type === FieldType.number,
      settings: config.settings || {},
    });
  }

  addTextInput<TSettings>(config: FieldConfigEditorConfig<TSettings & StringFieldConfigSettings>) {
    return this.addCustomEditor({
      ...config,
      override: standardEditorsRegistry.get('text').editor as any,
      editor: standardEditorsRegistry.get('text').editor as any,
      process: stringOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : field => field.type === FieldType.string,
      settings: config.settings || {},
    });
  }

  addSelect<TOption, TSettings = any>(config: FieldConfigEditorConfig<TSettings & SelectFieldConfigSettings<TOption>>) {
    return this.addCustomEditor({
      ...config,
      override: standardEditorsRegistry.get('select').editor as any,
      editor: standardEditorsRegistry.get('select').editor as any,
      process: selectOverrideProcessor,
      // ???
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || { options: [] },
    });
  }

  addRadio<TOption, TSettings = any>(config: FieldConfigEditorConfig<TSettings & SelectFieldConfigSettings<TOption>>) {
    return this.addCustomEditor({
      ...config,
      override: standardEditorsRegistry.get('radio').editor as any,
      editor: standardEditorsRegistry.get('radio').editor as any,
      process: selectOverrideProcessor,
      // ???
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || { options: [] },
    });
  }

  addBooleanSwitch<TSettings = any>(config: FieldConfigEditorConfig<TSettings>) {
    return this.addCustomEditor({
      ...config,
      editor: standardEditorsRegistry.get('boolean').editor as any,
      override: standardEditorsRegistry.get('boolean').editor as any,
      process: booleanOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }

  addColorPicker<TSettings = any>(config: FieldConfigEditorConfig<TSettings & ColorFieldConfigSettings>) {
    return this.addCustomEditor({
      ...config,
      editor: standardEditorsRegistry.get('color').editor as any,
      override: standardEditorsRegistry.get('color').editor as any,
      process: identityOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }

  addUnitPicker<TSettings = any>(config: FieldConfigEditorConfig<TSettings & UnitFieldConfigSettings>) {
    return this.addCustomEditor({
      ...config,
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
export class PanelOptionsEditorBuilder extends OptionsUIRegistryBuilder<StandardEditorProps, PanelOptionsEditorItem> {
  addNumberInput<TSettings>(config: PanelOptionsEditorConfig<TSettings & NumberFieldConfigSettings>) {
    return this.addCustomEditor({
      ...config,
      editor: standardEditorsRegistry.get('number').editor as any,
    });
  }

  addTextInput<TSettings>(config: PanelOptionsEditorConfig<TSettings & StringFieldConfigSettings>) {
    return this.addCustomEditor({
      ...config,
      editor: standardEditorsRegistry.get('text').editor as any,
    });
  }

  addSelect<TOption, TSettings>(config: PanelOptionsEditorConfig<TSettings & SelectFieldConfigSettings<TOption>>) {
    return this.addCustomEditor({
      ...config,
      editor: standardEditorsRegistry.get('select').editor as any,
    });
  }

  addRadio<TOption, TSettings>(config: PanelOptionsEditorConfig<TSettings & SelectFieldConfigSettings<TOption>>) {
    return this.addCustomEditor({
      ...config,
      editor: standardEditorsRegistry.get('radio').editor as any,
    });
  }

  addBooleanSwitch<TSettings = any>(config: PanelOptionsEditorConfig<TSettings>) {
    return this.addCustomEditor({
      ...config,
      editor: standardEditorsRegistry.get('boolean').editor as any,
    });
  }

  addColorPicker<TSettings = any>(config: PanelOptionsEditorConfig<TSettings & ColorFieldConfigSettings>): this {
    return this.addCustomEditor({
      ...config,
      editor: standardEditorsRegistry.get('color').editor as any,
      settings: config.settings || {},
    });
  }

  addUnitPicker<TSettings = any>(config: PanelOptionsEditorConfig<TSettings & UnitFieldConfigSettings>): this {
    return this.addCustomEditor({
      ...config,
      editor: standardEditorsRegistry.get('unit').editor as any,
    });
  }
}
