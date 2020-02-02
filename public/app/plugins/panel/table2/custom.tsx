import {
  GrafanaTheme,
  FieldConfigSource,
  FieldPropertyEditorItem,
  Registry,
  FieldConfigEditorRegistry,
  PanelData,
  LoadingState,
  DefaultTimeRange,
} from '@grafana/data';
import {
  stylesFactory,
  FieldConfigEditor,
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
};

export const tableFieldRegistry: FieldConfigEditorRegistry = new Registry<FieldPropertyEditorItem>(() => {
  return [columWidth];
});
