import { FieldConfigEditorRegistry, Registry, FieldPropertyEditorItem } from '@grafana/data';
import { StringValueEditor, StringOverrideEditor, stringOverrideProcessor, StringFieldConfigSettings } from './string';
import { NumberValueEditor, NumberOverrideEditor, numberOverrideProcessor, NumberFieldConfigSettings } from './number';

const titleItem: FieldPropertyEditorItem<string, StringFieldConfigSettings> = {
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

const minItem: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
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

const decimalsItem: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
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

export const standardFieldConfigEditorRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>(
  () => {
    return [titleItem, minItem, decimalsItem];
  }
);
