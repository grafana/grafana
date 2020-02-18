import { FieldPropertyEditorItem, Registry, FieldConfigEditorRegistry } from '@grafana/data';
import {
  NumberValueEditor,
  NumberOverrideEditor,
  numberOverrideProcessor,
  NumberFieldConfigSettings,
  stringSelectOverrideProcessor,
  StringSelectValueEditor,
  StringSelectOverrideEditor,
  StringSelectFieldConfigSettings,
} from '@grafana/ui';

export const tableFieldRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>(() => {
  const columWidth: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'width', // Match field properties
    name: 'Column Width',
    description: 'column width (for table)',

    editor: NumberValueEditor,
    override: NumberOverrideEditor,
    process: numberOverrideProcessor,

    settings: {
      placeholder: 'auto',
      min: 20,
      max: 300,
    },

    shouldApply: () => true,
  };

  const cellDisplayMode: FieldPropertyEditorItem<string, StringSelectFieldConfigSettings> = {
    id: 'displayMode', // Match field properties
    name: 'Display mode',
    description: 'Cell display mode',

    editor: StringSelectValueEditor,
    override: StringSelectOverrideEditor,
    process: stringSelectOverrideProcessor,

    settings: {
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'color-background', label: 'Color background' },
        { value: 'gradient-gauge', label: 'Gradient gauge' },
        { value: 'lcd-gauge', label: 'LCD gauge' },
      ],
    },

    shouldApply: () => true,
  };

  return [columWidth, cellDisplayMode];
});
