import { DataLink, FieldPropertyEditorItem, FieldType, ThresholdsConfig } from '@grafana/data';
import { StringFieldConfigSettings, StringOverrideEditor, stringOverrideProcessor, StringValueEditor } from './string';
import { NumberFieldConfigSettings, NumberOverrideEditor, numberOverrideProcessor, NumberValueEditor } from './number';
import { UnitOverrideEditor, UnitValueEditor } from './units';
import {
  ThresholdsFieldConfigSettings,
  ThresholdsOverrideEditor,
  thresholdsOverrideProcessor,
  ThresholdsValueEditor,
} from './thresholds';
import { DataLinksOverrideEditor, dataLinksOverrideProcessor, DataLinksValueEditor } from './links';

export const getStandardFieldConfigs = () => {
  const title: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'title', // Match field properties
    name: 'Title',
    description: 'The field title',

    editor: StringValueEditor,
    override: StringOverrideEditor,
    process: stringOverrideProcessor,
    settings: {
      placeholder: 'auto',
      expandTemplateVars: true,
    },
    shouldApply: field => field.type !== FieldType.time,
  };

  const unit: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'unit', // Match field properties
    name: 'Unit',
    description: 'value units',

    editor: UnitValueEditor,
    override: UnitOverrideEditor,
    process: stringOverrideProcessor,

    settings: {
      placeholder: 'none',
    },

    shouldApply: field => field.type === FieldType.number,
  };

  const min: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'min', // Match field properties
    name: 'Min',
    description: 'Minimum expected value',

    editor: NumberValueEditor,
    override: NumberOverrideEditor,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },
    shouldApply: field => field.type === FieldType.number,
  };

  const max: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'max', // Match field properties
    name: 'Max',
    description: 'Maximum expected value',

    editor: NumberValueEditor,
    override: NumberOverrideEditor,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },

    shouldApply: field => field.type === FieldType.number,
  };

  const decimals: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'decimals', // Match field properties
    name: 'Decimals',
    description: 'How many decimal places should be shown on a number',

    editor: NumberValueEditor,
    override: NumberOverrideEditor,
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
    id: 'thresholds', // Match field properties
    name: 'Thresholds',
    description: 'Manage Thresholds',

    editor: ThresholdsValueEditor,
    override: ThresholdsOverrideEditor,
    process: thresholdsOverrideProcessor,

    settings: {
      // ??
    },

    shouldApply: field => field.type === FieldType.number,
  };

  const noValue: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'noValue', // Match field properties
    name: 'No Value',
    description: 'What to show when there is no value',

    editor: StringValueEditor,
    override: StringOverrideEditor,
    process: stringOverrideProcessor,

    settings: {
      placeholder: '-',
    },
    // ??? any field with no value
    shouldApply: () => true,
  };

  const links: FieldPropertyEditorItem<DataLink[], StringFieldConfigSettings> = {
    id: 'links', // Match field properties
    name: 'DataLinks',
    description: 'Manage date links',
    editor: DataLinksValueEditor,
    override: DataLinksOverrideEditor,
    process: dataLinksOverrideProcessor,
    settings: {
      placeholder: '-',
    },
    shouldApply: () => true,
  };

  return [unit, min, max, decimals, thresholds, title, noValue, links];
};
