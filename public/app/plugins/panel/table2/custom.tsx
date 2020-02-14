import { FieldPropertyEditorItem, Registry, FieldConfigEditorRegistry } from '@grafana/data';
import {
  NumberValueEditor,
  NumberOverrideEditor,
  numberOverrideProcessor,
  NumberFieldConfigSettings,
} from '@grafana/ui';

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

export const tableFieldRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>(() => {
  return [columWidth];
});
