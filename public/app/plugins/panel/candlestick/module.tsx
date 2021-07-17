import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { CandlestickPanel } from './CandlestickPanel';
import { commonOptionsBuilder } from '@grafana/ui';
import { PanelOptions, PanelFieldConfig } from './models.gen';
import { CandlestickFieldMappingsEditor } from './CandlestickFieldMappingEditor';

export const plugin = new PanelPlugin<PanelOptions, PanelFieldConfig>(CandlestickPanel)
  .setPanelOptions((builder) => {
    // nothing yet
    builder.addCustomEditor({
      category: ['Field names'],
      id: 'content',
      path: 'names',
      name: 'Field names',
      editor: CandlestickFieldMappingsEditor,
      defaultValue: {},
    });
  })
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },
    useCustomConfig: (builder) => {
      commonOptionsBuilder.addHideFrom(builder);
    },
  });
