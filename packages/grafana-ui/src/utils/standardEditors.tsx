import React from 'react';
import {
  DataLink,
  dataLinksOverrideProcessor,
  FieldConfigPropertyItem,
  FieldType,
  NumberFieldConfigSettings,
  numberOverrideProcessor,
  standardEditorsRegistry,
  StandardEditorsRegistryItem,
  StringFieldConfigSettings,
  stringOverrideProcessor,
  ThresholdsConfig,
  ThresholdsFieldConfigSettings,
  thresholdsOverrideProcessor,
  ValueMapping,
  ValueMappingFieldConfigSettings,
  valueMappingsOverrideProcessor,
  ThresholdsMode,
  TimeZone,
} from '@grafana/data';

import { Switch } from '../components/Switch/Switch';
import {
  NumberValueEditor,
  RadioButtonGroup,
  StringValueEditor,
  StringArrayEditor,
  SelectValueEditor,
  TimeZonePicker,
} from '../components';
import { ValueMappingsValueEditor } from '../components/OptionsUI/mappings';
import { ThresholdsValueEditor } from '../components/OptionsUI/thresholds';
import { UnitValueEditor } from '../components/OptionsUI/units';
import { DataLinksValueEditor } from '../components/OptionsUI/links';
import { ColorValueEditor } from '../components/OptionsUI/color';
import { StatsPickerEditor } from '../components/OptionsUI/stats';

/**
 * Returns collection of common field config properties definitions
 */
export const getStandardFieldConfigs = () => {
  const category = ['Standard options'];
  const displayName: FieldConfigPropertyItem<any, string, StringFieldConfigSettings> = {
    id: 'displayName',
    path: 'displayName',
    name: 'Display name',
    description: 'Change the field or series name',
    editor: standardEditorsRegistry.get('text').editor as any,
    override: standardEditorsRegistry.get('text').editor as any,
    process: stringOverrideProcessor,
    settings: {
      placeholder: 'none',
      expandTemplateVars: true,
    },
    shouldApply: () => true,
    category,
  };

  const unit: FieldConfigPropertyItem<any, string, StringFieldConfigSettings> = {
    id: 'unit',
    path: 'unit',
    name: 'Unit',
    description: '',

    editor: standardEditorsRegistry.get('unit').editor as any,
    override: standardEditorsRegistry.get('unit').editor as any,
    process: stringOverrideProcessor,

    settings: {
      placeholder: 'none',
    },

    shouldApply: field => field.type === FieldType.number,
    category,
  };

  const min: FieldConfigPropertyItem<any, number, NumberFieldConfigSettings> = {
    id: 'min',
    path: 'min',
    name: 'Min',
    description: 'Leave empty to calculate based on all values',

    editor: standardEditorsRegistry.get('number').editor as any,
    override: standardEditorsRegistry.get('number').editor as any,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },
    shouldApply: field => field.type === FieldType.number,
    category,
  };

  const max: FieldConfigPropertyItem<any, number, NumberFieldConfigSettings> = {
    id: 'max',
    path: 'max',
    name: 'Max',
    description: 'Leave empty to calculate based on all values',

    editor: standardEditorsRegistry.get('number').editor as any,
    override: standardEditorsRegistry.get('number').editor as any,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },

    shouldApply: field => field.type === FieldType.number,
    category,
  };

  const decimals: FieldConfigPropertyItem<any, number, NumberFieldConfigSettings> = {
    id: 'decimals',
    path: 'decimals',
    name: 'Decimals',

    editor: standardEditorsRegistry.get('number').editor as any,
    override: standardEditorsRegistry.get('number').editor as any,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
      min: 0,
      max: 15,
      integer: true,
    },

    shouldApply: field => field.type === FieldType.number,
    category,
  };

  const thresholds: FieldConfigPropertyItem<any, ThresholdsConfig, ThresholdsFieldConfigSettings> = {
    id: 'thresholds',
    path: 'thresholds',
    name: 'Thresholds',

    editor: standardEditorsRegistry.get('thresholds').editor as any,
    override: standardEditorsRegistry.get('thresholds').editor as any,
    process: thresholdsOverrideProcessor,
    settings: {},
    defaultValue: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' },
      ],
    },
    shouldApply: field => field.type === FieldType.number,
    category: ['Thresholds'],
    getItemsCount: value => (value ? value.steps.length : 0),
  };

  const mappings: FieldConfigPropertyItem<any, ValueMapping[], ValueMappingFieldConfigSettings> = {
    id: 'mappings',
    path: 'mappings',
    name: 'Value mappings',
    description: 'Modify the display text based on input value',

    editor: standardEditorsRegistry.get('mappings').editor as any,
    override: standardEditorsRegistry.get('mappings').editor as any,
    process: valueMappingsOverrideProcessor,
    settings: {},
    defaultValue: [],
    shouldApply: () => true,
    category: ['Value mappings'],
    getItemsCount: (value?) => (value ? value.length : 0),
  };

  const noValue: FieldConfigPropertyItem<any, string, StringFieldConfigSettings> = {
    id: 'noValue',
    path: 'noValue',
    name: 'No Value',
    description: 'What to show when there is no value',

    editor: standardEditorsRegistry.get('text').editor as any,
    override: standardEditorsRegistry.get('text').editor as any,
    process: stringOverrideProcessor,

    settings: {
      placeholder: '-',
    },
    // ??? any optionsUi with no value
    shouldApply: () => true,
    category,
  };

  const links: FieldConfigPropertyItem<any, DataLink[], StringFieldConfigSettings> = {
    id: 'links',
    path: 'links',
    name: 'Data links',
    editor: standardEditorsRegistry.get('links').editor as any,
    override: standardEditorsRegistry.get('links').editor as any,
    process: dataLinksOverrideProcessor,
    settings: {
      placeholder: '-',
    },
    shouldApply: () => true,
    category: ['Data links'],
    getItemsCount: value => (value ? value.length : 0),
  };

  // const color: FieldConfigPropertyItem<any, string, StringFieldConfigSettings> = {
  //   id: 'color',
  //   path: 'color',
  //   name: 'Color',
  //   description: 'Customise color',
  //   editor: standardEditorsRegistry.get('color').editor as any,
  //   override: standardEditorsRegistry.get('color').editor as any,
  //   process: identityOverrideProcessor,
  //   settings: {
  //     placeholder: '-',
  //   },
  //   shouldApply: () => true,
  //   category: ['Color & thresholds'],
  // };

  return [unit, min, max, decimals, displayName, noValue, thresholds, mappings, links];
};

/**
 * Returns collection of standard option editors definitions
 */
export const getStandardOptionEditors = () => {
  const number: StandardEditorsRegistryItem<number> = {
    id: 'number',
    name: 'Number',
    description: 'Allows numeric values input',
    editor: NumberValueEditor as any,
  };

  const text: StandardEditorsRegistryItem<string> = {
    id: 'text',
    name: 'Text',
    description: 'Allows string values input',
    editor: StringValueEditor as any,
  };

  const strings: StandardEditorsRegistryItem<string[]> = {
    id: 'strings',
    name: 'String array',
    description: 'An array of strings',
    editor: StringArrayEditor as any,
  };

  const boolean: StandardEditorsRegistryItem<boolean> = {
    id: 'boolean',
    name: 'Boolean',
    description: 'Allows boolean values input',
    editor: props => <Switch {...props} onChange={e => props.onChange(e.currentTarget.checked)} />,
  };

  const select: StandardEditorsRegistryItem<any> = {
    id: 'select',
    name: 'Select',
    description: 'Allows option selection',
    editor: SelectValueEditor as any,
  };

  const radio: StandardEditorsRegistryItem<any> = {
    id: 'radio',
    name: 'Radio',
    description: 'Allows option selection',
    editor: props => <RadioButtonGroup {...props} options={props.item.settings?.options} />,
  };

  const unit: StandardEditorsRegistryItem<string> = {
    id: 'unit',
    name: 'Unit',
    description: 'Allows unit input',
    editor: UnitValueEditor as any,
  };

  const thresholds: StandardEditorsRegistryItem<ThresholdsConfig> = {
    id: 'thresholds',
    name: 'Thresholds',
    description: 'Allows defining thresholds',
    editor: ThresholdsValueEditor as any,
  };

  const mappings: StandardEditorsRegistryItem<ValueMapping[]> = {
    id: 'mappings',
    name: 'Mappings',
    description: 'Allows defining value mappings',
    editor: ValueMappingsValueEditor as any,
  };

  const color: StandardEditorsRegistryItem<string> = {
    id: 'color',
    name: 'Color',
    description: 'Allows color selection',
    editor: ColorValueEditor as any,
  };

  const links: StandardEditorsRegistryItem<DataLink[]> = {
    id: 'links',
    name: 'Links',
    description: 'Allows defining data links',
    editor: DataLinksValueEditor as any,
  };

  const statsPicker: StandardEditorsRegistryItem<string[]> = {
    id: 'stats-picker',
    name: 'Stats Picker',
    editor: StatsPickerEditor as any,
    description: '',
  };

  const timeZone: StandardEditorsRegistryItem<TimeZone> = {
    id: 'timezone',
    name: 'Time Zone',
    description: 'Time zone selection',
    editor: TimeZonePicker as any,
  };

  return [
    text,
    number,
    boolean,
    radio,
    select,
    unit,
    mappings,
    thresholds,
    links,
    color,
    statsPicker,
    strings,
    timeZone,
  ];
};
