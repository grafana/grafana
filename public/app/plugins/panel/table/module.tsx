import { PanelPlugin } from '@grafana/data';
import { TablePanel } from './TablePanel';
import { CustomFieldConfig, Options } from './types';
import { tablePanelChangedHandler, tableMigrationHandler } from './migrations';

export const plugin = new PanelPlugin<Options, CustomFieldConfig>(TablePanel)
  .setPanelChangeHandler(tablePanelChangedHandler)
  .setMigrationHandler(tableMigrationHandler)
  .setNoPadding()
  .useFieldConfig({
    useCustomConfig: builder => {
      builder
        .addNumberInput({
          path: 'width',
          name: 'Column width',
          settings: {
            placeholder: 'auto',
            min: 20,
            max: 300,
          },
          shouldApply: () => true,
        })
        .addRadio({
          path: 'align',
          name: 'Column alignment',
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
          description: 'Color text, background, show as gauge, etc',
          settings: {
            options: [
              { value: 'auto', label: 'Auto' },
              { value: 'color-text', label: 'Color text' },
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
      defaultValue: true,
    });
  });
