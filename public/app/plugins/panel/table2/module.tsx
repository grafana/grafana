import { PanelPlugin } from '@grafana/data';
import { TablePanel } from './TablePanel';
import { CustomFieldConfig, defaults, Options } from './types';

export const plugin = new PanelPlugin<Options, CustomFieldConfig>(TablePanel)
  .setDefaults(defaults)
  .useFieldConfig({
    useCustomConfig: builder => {
      builder
        .addNumberInput({
          path: 'width',
          name: 'Column width',
          description: 'column width (for table)',
          settings: {
            placeholder: 'auto',
            min: 20,
            max: 300,
          },
        })
        .addRadio({
          path: 'align',
          name: 'Column alignment',
          description: 'column alignment (for table)',
          settings: {
            options: [
              { label: 'auto', value: null },
              { label: 'left', value: 'left' },
              { label: 'center', value: 'center' },
              { label: 'right', value: 'right' },
            ],
          },
          defaultValue: null,
        })
        .addSelect({
          path: 'displayMode',
          name: 'Cell display mode',
          description: 'Color value, background, show as gauge, etc',
          settings: {
            options: [
              { value: 'auto', label: 'Auto' },
              { value: 'color-background', label: 'Color background' },
              { value: 'gradient-gauge', label: 'Gradient gauge' },
              { value: 'lcd-gauge', label: 'LCD gauge' },
            ],
          },
        });
    },
  })
  .setPanelOptions(builder => {
    builder.addBooleanSwitch({
      path: 'showHeader',
      name: 'Show header',
      description: "To display table's header or not to display",
    });
  })
  .setPanelOptions(builder => {
    builder.addBooleanSwitch({
      path: 'resizable',
      name: 'Resizable',
      description: 'Toggles if table columns are resizable or not',
    });
  });
