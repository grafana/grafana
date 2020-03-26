import React from 'react';
import {
  DataLink,
  dataLinksOverrideProcessor,
  FieldPropertyEditorItem,
  FieldType,
  identityOverrideProcessor,
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
} from '@grafana/data';
import { NumberValueEditor, Forms, StringValueEditor } from '../components';
import { ValueMappingsValueEditor } from '../components/OptionsUI/mappings';
import { ThresholdsValueEditor } from '../components/OptionsUI/thresholds';
import { UnitValueEditor } from '../components/OptionsUI/units';
import { DataLinksValueEditor } from '../components/OptionsUI/links';
import { ColorValueEditor } from '../components/OptionsUI/color';

/**
 * Returns collection of common field config properties definitions
 */
export const getStandardFieldConfigs = () => {
  const title: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'title',
    name: 'Title',
    description: "Field's title",
    editor: standardEditorsRegistry.get('text').editor as any,
    override: standardEditorsRegistry.get('text').editor as any,
    process: stringOverrideProcessor,
    settings: {
      placeholder: 'auto',
      expandTemplateVars: true,
    },
    shouldApply: field => field.type !== FieldType.time,
  };

  const unit: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'unit',
    name: 'Unit',
    description: 'Value units',

    editor: standardEditorsRegistry.get('unit').editor as any,
    override: standardEditorsRegistry.get('unit').editor as any,
    process: stringOverrideProcessor,

    settings: {
      placeholder: 'none',
    },

    shouldApply: field => field.type === FieldType.number,
  };

  const min: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'min',
    name: 'Min',
    description: 'Minimum expected value',

    editor: standardEditorsRegistry.get('number').editor as any,
    override: standardEditorsRegistry.get('number').editor as any,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },
    shouldApply: field => field.type === FieldType.number,
  };

  const max: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'max',
    name: 'Max',
    description: 'Maximum expected value',

    editor: standardEditorsRegistry.get('number').editor as any,
    override: standardEditorsRegistry.get('number').editor as any,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },

    shouldApply: field => field.type === FieldType.number,
  };

  const decimals: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'decimals',
    name: 'Decimals',
    description: 'Number of decimal to be shown for a value',

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
  };

  const thresholds: FieldPropertyEditorItem<ThresholdsConfig, ThresholdsFieldConfigSettings> = {
    id: 'thresholds',
    name: 'Thresholds',
    description: 'Manage thresholds',

    editor: standardEditorsRegistry.get('thresholds').editor as any,
    override: standardEditorsRegistry.get('thresholds').editor as any,
    process: thresholdsOverrideProcessor,

    settings: {
      // ??
    },

    shouldApply: field => field.type === FieldType.number,
  };

  const mappings: FieldPropertyEditorItem<ValueMapping[], ValueMappingFieldConfigSettings> = {
    id: 'mappings',
    name: 'Value mappings',
    description: 'Manage value mappings',

    editor: standardEditorsRegistry.get('mappings').editor as any,
    override: standardEditorsRegistry.get('mappings').editor as any,
    process: valueMappingsOverrideProcessor,
    settings: {
      // ??
    },

    shouldApply: field => field.type === FieldType.number,
  };

  const noValue: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'noValue',
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
  };

  const links: FieldPropertyEditorItem<DataLink[], StringFieldConfigSettings> = {
    id: 'links',
    name: 'DataLinks',
    description: 'Manage date links',
    editor: standardEditorsRegistry.get('links').editor as any,
    override: standardEditorsRegistry.get('links').editor as any,
    process: dataLinksOverrideProcessor,
    settings: {
      placeholder: '-',
    },
    shouldApply: () => true,
  };

  const color: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'color',
    name: 'Color',
    description: 'Customise color',
    editor: standardEditorsRegistry.get('color').editor as any,
    override: standardEditorsRegistry.get('color').editor as any,
    process: identityOverrideProcessor,
    settings: {
      placeholder: '-',
    },
    shouldApply: () => true,
  };

  return [unit, min, max, decimals, title, noValue, thresholds, mappings, links, color];
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

  const boolean: StandardEditorsRegistryItem<boolean> = {
    id: 'boolean',
    name: 'Boolean',
    description: 'Allows boolean values input',
    editor: props => <Forms.Switch {...props} onChange={e => props.onChange(e.currentTarget.checked)} />,
  };

  const select: StandardEditorsRegistryItem<any> = {
    id: 'select',
    name: 'Select',
    description: 'Allows option selection',
    editor: props => (
      <Forms.Select
        defaultValue={props.value}
        onChange={e => props.onChange(e.value)}
        options={props.item.settings?.options}
      />
    ),
  };

  const radio: StandardEditorsRegistryItem<any> = {
    id: 'radio',
    name: 'Radio',
    description: 'Allows option selection',
    editor: props => <Forms.RadioButtonGroup {...props} options={props.item.settings?.options} />,
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

  return [text, number, boolean, radio, select, unit, mappings, thresholds, links, color];
};
