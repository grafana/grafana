import { set, cloneDeep } from 'lodash';

import {
  FieldNamePickerConfigSettings,
  NumberFieldConfigSettings,
  SelectFieldConfigSettings,
  SliderFieldConfigSettings,
  StringFieldConfigSettings,
  UnitFieldConfigSettings,
  booleanOverrideProcessor,
  identityOverrideProcessor,
  numberOverrideProcessor,
  selectOverrideProcessor,
  stringOverrideProcessor,
  unitOverrideProcessor,
} from '../field/overrides/processors';
import {
  StandardEditorContext,
  StandardEditorProps,
  standardEditorsRegistry,
} from '../field/standardFieldConfigEditorRegistry';
import { PanelOptionsSupplier } from '../panel/PanelPlugin';
import { OptionsEditorItem, OptionsUIRegistryBuilder } from '../types/OptionsUIRegistryBuilder';
import { isObject } from '../types/data';
import { FieldConfigPropertyItem, FieldConfigEditorConfig } from '../types/fieldOverrides';
import { PanelOptionsEditorConfig, PanelOptionsEditorItem } from '../types/panel';

/**
 * Fluent API for declarative creation of field config option editors
 */
export class FieldConfigEditorBuilder<TOptions> extends OptionsUIRegistryBuilder<
  TOptions,
  StandardEditorProps,
  FieldConfigPropertyItem<TOptions>
> {
  addNumberInput<TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings & NumberFieldConfigSettings, number>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      override: standardEditorsRegistry.get('number').editor,
      editor: standardEditorsRegistry.get('number').editor,
      process: numberOverrideProcessor,
      shouldApply: config.shouldApply ?? (() => true),
      settings: config.settings || {},
    });
  }

  addSliderInput<TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings & SliderFieldConfigSettings, number>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      override: standardEditorsRegistry.get('slider').editor,
      editor: standardEditorsRegistry.get('slider').editor,
      process: numberOverrideProcessor,
      shouldApply: config.shouldApply ?? (() => true),
      settings: config.settings || {},
    });
  }

  addTextInput<TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings & StringFieldConfigSettings, string>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      override: standardEditorsRegistry.get('text').editor,
      editor: standardEditorsRegistry.get('text').editor,
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
      override: standardEditorsRegistry.get('select').editor,
      editor: standardEditorsRegistry.get('select').editor,
      process: selectOverrideProcessor,
      // ???
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || { options: [] },
    });
  }

  addRadio<TOption, TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings, TOption>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      override: standardEditorsRegistry.get('radio').editor,
      editor: standardEditorsRegistry.get('radio').editor,
      process: selectOverrideProcessor,
      // ???
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || { options: [] },
    });
  }

  addBooleanSwitch<TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings, boolean>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('boolean').editor,
      override: standardEditorsRegistry.get('boolean').editor,
      process: booleanOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }

  addColorPicker<TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings, string>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('color').editor,
      override: standardEditorsRegistry.get('color').editor,
      process: identityOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }

  addUnitPicker<TSettings>(config: FieldConfigEditorConfig<TOptions, TSettings & UnitFieldConfigSettings, string>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('unit').editor,
      override: standardEditorsRegistry.get('unit').editor,
      process: unitOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }

  addFieldNamePicker<TSettings>(
    config: FieldConfigEditorConfig<TOptions, TSettings & FieldNamePickerConfigSettings, string>
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('field-name').editor,
      override: standardEditorsRegistry.get('field-name').editor,
      process: identityOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }

  addGenericEditor<TSettings>(
    config: FieldConfigEditorConfig<TOptions, TSettings & any>, // & any... i give up!
    editor: (props: StandardEditorProps<TSettings>) => JSX.Element
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: editor,
      override: editor,
      process: identityOverrideProcessor,
      shouldApply: config.shouldApply ? config.shouldApply : () => true,
      settings: config.settings || {},
    });
  }
}

export interface NestedValueAccess {
  getValue: (path: string) => any;
  onChange: (path: string, value: any) => void;
  getContext?: (parent: StandardEditorContext<any>) => StandardEditorContext<any>;
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
    this.defaultValue = this.getDefaultValue(cfg);
  }

  private getDefaultValue(cfg: NestedPanelOptions<TSub>): TSub {
    let result = isObject(cfg.defaultValue) ? cloneDeep(cfg.defaultValue) : {};

    const builder = new PanelOptionsEditorBuilder<TSub>();
    cfg.build(builder, { data: [] });

    for (const item of builder.getItems()) {
      if (item.defaultValue != null) {
        set(result, item.path, item.defaultValue);
      }
    }

    // TSub is defined as type any and we need to cast it back
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return result as TSub;
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

export function isNestedPanelOptions(item: unknown): item is NestedPanelOptionsBuilder {
  return isObject(item) && 'id' in item && item.id === 'nested-panel-options';
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
      editor: standardEditorsRegistry.get('number').editor,
    });
  }

  addSliderInput<TSettings>(config: PanelOptionsEditorConfig<TOptions, TSettings & SliderFieldConfigSettings, number>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('slider').editor,
    });
  }

  addTextInput<TSettings>(config: PanelOptionsEditorConfig<TOptions, TSettings & StringFieldConfigSettings, string>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('text').editor,
    });
  }

  addStringArray<TSettings>(
    config: PanelOptionsEditorConfig<TOptions, TSettings & StringFieldConfigSettings, string[]>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('strings').editor,
    });
  }

  addSelect<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: PanelOptionsEditorConfig<TOptions, TSettings, TOption>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('select').editor,
    });
  }

  addMultiSelect<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: PanelOptionsEditorConfig<TOptions, TSettings, TOption>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('multi-select').editor,
    });
  }

  addRadio<TOption, TSettings extends SelectFieldConfigSettings<TOption>>(
    config: PanelOptionsEditorConfig<TOptions, TSettings, TOption>
  ) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('radio').editor,
    });
  }

  addBooleanSwitch<TSettings>(config: PanelOptionsEditorConfig<TOptions, TSettings, boolean>) {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('boolean').editor,
    });
  }

  addColorPicker<TSettings>(config: PanelOptionsEditorConfig<TOptions, TSettings, string>): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('color').editor,
      settings: config.settings || {},
    });
  }

  addTimeZonePicker<TSettings>(config: PanelOptionsEditorConfig<TOptions, TSettings, string>): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('timezone').editor,
      settings: config.settings || {},
    });
  }

  addUnitPicker<TSettings>(
    config: PanelOptionsEditorConfig<TOptions, TSettings & UnitFieldConfigSettings, string>
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('unit').editor,
    });
  }

  addFieldNamePicker<TSettings>(
    config: PanelOptionsEditorConfig<TOptions, TSettings & FieldNamePickerConfigSettings, string>
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('field-name').editor,
    });
  }

  addDashboardPicker<TSettings>(
    config: PanelOptionsEditorConfig<TOptions, TSettings & FieldNamePickerConfigSettings, string>
  ): this {
    return this.addCustomEditor({
      ...config,
      id: config.path,
      editor: standardEditorsRegistry.get('dashboard-uid').editor, // added at runtime
    });
  }
}
