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
  SliderFieldConfigSettings,
  identityOverrideProcessor,
  UnitFieldConfigSettings,
  unitOverrideProcessor,
  FieldNamePickerConfigSettings,
  StandardEditorContext,
} from '../field';
import { PanelOptionsSupplier } from '../panel/PanelPlugin';
import { OptionsEditorItem, OptionsUIRegistryBuilder } from '../types/OptionsUIRegistryBuilder';
import { FieldConfigEditorProps, FieldConfigPropertyItem, FieldConfigEditorConfig } from '../types/fieldOverrides';
import { PanelOptionsEditorConfig, PanelOptionsEditorItem } from '../types/panel';

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
      shouldApply: config.shouldApply ?? (() => true),
      settings: config.settings || {},
    });
  }

  addSliderInput<TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings & SliderFieldConfigSettings, number>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      override: standardEditorsRegistry.get('slider').editor as any,
      editor: standardEditorsRegistry.get('slider').editor as any,
      process: numberOverrideProcessor,
      shouldApply: config.shouldApply ?? (() => true),
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
      shouldApply: config.shouldApply ?? (() => true),
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

  addColorPicker<TSettings = any>(config: FieldConfigEditorConfig<TOptions, TSettings, string>) {
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

  addFieldNamePicker<TSettings = any>(
    config: FieldConfigEditorConfig<TOptions, TSettings & FieldNamePickerConfigSettings, string>
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('field-name').editor as any,
      override: standardEditorsRegistry.get('field-name').editor as any,
      process: identityOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }
}

export interface NestedValueAccess {
  getValue: (path: string) => any;
  onChange: (path: string, value: any) => void;
  getContext?: (parent: StandardEditorContext<any, any>) => StandardEditorContext<any, any>;
}
export interface NestedPanelOptions<TSub = any> {
  path: string;
  category?: string[];
  defaultValue?: TSub;
  build: PanelOptionsSupplier<TSub>;
  values?: (parent: NestedValueAccess) => NestedValueAccess;
}

export class NestedPanelOptionsBuilder<TSub = any> implements OptionsEditorItem<TSub, any, any, any> {
  path = '';
  category?: string[];
  defaultValue?: TSub;
  id = 'nested-panel-options';
  name = 'nested';
  editor = () => null;

  constructor(public cfg: NestedPanelOptions<TSub>) {
    this.path = cfg.path;
    this.category = cfg.category;
    this.defaultValue = cfg.defaultValue;
  }

  getBuilder = () => {
    return this.cfg.build;
  };

  getNestedValueAccess = (parent: NestedValueAccess) => {
    const values = this.cfg.values;
    if (values) {
      return values(parent);
    }
    // by default prefix the path
    return {
      getValue: (path: string) => parent.getValue(`${this.path}.${path}`),
      onChange: (path: string, value: any) => parent.onChange(`${this.path}.${path}`, value),
    };
  };
}

export function isNestedPanelOptions(item: any): item is NestedPanelOptionsBuilder {
  return item.id === 'nested-panel-options';
}

/**
 * Fluent API for declarative creation of panel options
 */
export class PanelOptionsEditorBuilder<TOptions> extends OptionsUIRegistryBuilder<
  TOptions,
  StandardEditorProps,
  PanelOptionsEditorItem<TOptions>
> {
  addNestedOptions<Sub>(opts: NestedPanelOptions<Sub>) {
    const s = new NestedPanelOptionsBuilder<Sub>(opts);
    return this.addCustomEditor(s);
  }

  addNumberInput<TSettings>(config: PanelOptionsEditorConfig<TOptions, TSettings & NumberFieldConfigSettings, number>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('number').editor as any,
    });
  }

  addSliderInput<TSettings>(config: PanelOptionsEditorConfig<TOptions, TSettings & SliderFieldConfigSettings, number>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('slider').editor as any,
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

  addMultiSelect<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: PanelOptionsEditorConfig<TOptions, TSettings, TOption>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('multi-select').editor as any,
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

  addColorPicker<TSettings = any>(config: PanelOptionsEditorConfig<TOptions, TSettings, string>): this {
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

  addFieldNamePicker<TSettings = any>(
    config: PanelOptionsEditorConfig<TOptions, TSettings & FieldNamePickerConfigSettings, string>
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('field-name').editor as any,
    });
  }

  addDashboardPicker<TSettings = any>(
    config: PanelOptionsEditorConfig<TOptions, TSettings & FieldNamePickerConfigSettings, string>
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('dashboard-uid').editor as any, // added at runtime
    });
  }
}
