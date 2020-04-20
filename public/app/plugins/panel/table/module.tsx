import { PanelPlugin } from '@grafana/data';
import { TablePanel } from './TablePanel';
import { CustomFieldConfig, Options } from './types';
import { tablePanelChangedHandler, tableMigrationHandler } from './migrations';
import { TableCellDisplayMode } from '@grafana/ui/src/components/Table/types';

export const plugin = new PanelPlugin<Options, CustomFieldConfig>(TablePanel)
  .setPanelChangeHandler(tablePanelChangedHandler)
  .setMigrationHandler(tableMigrationHandler)
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
          description: 'Color text, background, show as gauge, etc',
          settings: {
            options: [
              { value: TableCellDisplayMode.Auto, label: 'Auto' },
              { value: TableCellDisplayMode.ColorText, label: 'Color text' },
              { value: TableCellDisplayMode.ColorBackground, label: 'Color background' },
              { value: TableCellDisplayMode.GradientGauge, label: 'Gradient gauge' },
              { value: TableCellDisplayMode.LcdGauge, label: 'LCD gauge' },
              { value: TableCellDisplayMode.JSONView, label: 'JSON View' },
            ],
          },
        });
    },
  })
  .setPanelOptions(builder => {
    builder
      .addBooleanSwitch({
        path: 'showHeader',
        name: 'Show header',
        description: "To display table's header or not to display",
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'resizable',
        name: 'Resizable',
        description: 'Toggles if table columns are resizable or not',
        defaultValue: false,
      });
  });
