import { FieldPropertyEditorItem, Registry, FieldConfigEditorRegistry } from '@grafana/data';
import {
  NumberValueEditor,
  NumberOverrideEditor,
  numberOverrideProcessor,
  NumberFieldConfigSettings,
  selectOverrideProcessor,
  SelectValueEditor,
  SelectOverrideEditor,
  SelectFieldConfigSettings,
} from '@grafana/ui';

export const tableFieldRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>(() => {
  const columWidth: FieldPropertyEditorItem<number, NumberFieldConfigSettings> = {
    id: 'width', // Match field properties
    name: 'Column width',
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

  const cellDisplayMode: FieldPropertyEditorItem<string, SelectFieldConfigSettings<string>> = {
    id: 'displayMode', // Match field properties
    name: 'Cell display mode',
    description: 'Color value, background, show as gauge, etc',

    editor: SelectValueEditor,
    override: SelectOverrideEditor,
    process: selectOverrideProcessor,

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
