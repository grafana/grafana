import { FieldPropertyEditorItem, ThresholdsConfig, DataLink } from '@grafana/data';
import { StringValueEditor, StringOverrideEditor, stringOverrideProcessor, StringFieldConfigSettings } from './string';
import { NumberValueEditor, NumberOverrideEditor, numberOverrideProcessor, NumberFieldConfigSettings } from './number';
import { UnitValueEditor, UnitOverrideEditor } from './units';
import {
  ThresholdsValueEditor,
  ThresholdsOverrideEditor,
  thresholdsOverrideProcessor,
  ThresholdsFieldConfigSettings,
} from './thresholds';
import { DataLinksValueEditor, DataLinksOverrideEditor, dataLinksOverrideProcessor } from './links';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace StandardFieldConfigEditors {
  export const title: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'title', // Match field properties
    name: 'Title',
    description: 'The field title',

    editor: StringValueEditor,
    override: StringOverrideEditor,
    process: stringOverrideProcessor,
    settings: {
      placeholder: 'auto',
    },
  };

  export const unit: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'unit', // Match field properties
    name: 'Unit',
    description: 'value units',

    editor: UnitValueEditor,
    override: UnitOverrideEditor,
    process: stringOverrideProcessor,

    settings: {
      placeholder: 'none',
    },
  };

  export const min: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'min', // Match field properties
    name: 'Min',
    description: 'Minimum expected value',

    editor: NumberValueEditor,
    override: NumberOverrideEditor,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },
  };

  export const max: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'max', // Match field properties
    name: 'Max',
    description: 'Maximum expected value',

    editor: NumberValueEditor,
    override: NumberOverrideEditor,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
    },
  };

  export const decimals: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
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
  };

  export const thresholds: FieldPropertyEditorItem<ThresholdsConfig, ThresholdsFieldConfigSettings> = {
    id: 'thresholds', // Match field properties
    name: 'Thresholds',
    description: 'Manage Thresholds',

    editor: ThresholdsValueEditor,
    override: ThresholdsOverrideEditor,
    process: thresholdsOverrideProcessor,

    settings: {
      // ??
    },
  };

  export const noValue: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
    id: 'noValue', // Match field properties
    name: 'No Value',
    description: 'What to show when there is no value',

    editor: StringValueEditor,
    override: StringOverrideEditor,
    process: stringOverrideProcessor,

    settings: {
      placeholder: '-',
    },
  };

  export const links: FieldPropertyEditorItem<DataLink[], StringFieldConfigSettings> = {
    id: 'links', // Match field properties
    name: 'DataLinks',
    description: 'Manage date links',
    editor: DataLinksValueEditor,
    override: DataLinksOverrideEditor,
    process: dataLinksOverrideProcessor,
    settings: {
      placeholder: '-',
    },
  };
}
