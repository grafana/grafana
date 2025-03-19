import { PanelPlugin, standardEditorsRegistry, identityOverrideProcessor, FieldConfigProperty } from '@grafana/data';
import { TableCellOptions, TableCellDisplayMode, defaultTableFieldOptions, TableCellHeight } from '@grafana/schema';

import { PaginationEditor } from './PaginationEditor';
import { TableCellOptionEditor } from './TableCellOptionEditor';
import { TablePanel } from './TablePanel';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { Options, defaultOptions, FieldConfig } from './panelcfg.gen';
import { TableSuggestionsSupplier } from './suggestions';

const footerCategory = 'Table footer';
const cellCategory = ['Cell options'];

export const plugin = new PanelPlugin<Options, FieldConfig>(TablePanel)
  .setPanelChangeHandler(tablePanelChangedHandler)
  .setMigrationHandler(tableMigrationHandler)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Actions]: {
        hideFromDefaults: false,
      },
    },
    useCustomConfig: (builder) => {
      builder
        .addNumberInput({
          path: 'minWidth',
          name: 'Minimum column width',
          description: 'The minimum width for column auto resizing',
          settings: {
            placeholder: '150',
            min: 50,
            max: 500,
          },
          shouldApply: () => true,
          defaultValue: defaultTableFieldOptions.minWidth,
        })
        .addNumberInput({
          path: 'width',
          name: 'Column width',
          settings: {
            placeholder: 'auto',
            min: 20,
            max: 300,
          },
          shouldApply: () => true,
          defaultValue: defaultTableFieldOptions.width,
        })
        .addRadio({
          path: 'align',
          name: 'Column alignment',
          settings: {
            options: [
              { label: 'Auto', value: 'auto' },
              { label: 'Left', value: 'left' },
              { label: 'Center', value: 'center' },
              { label: 'Right', value: 'right' },
            ],
          },
          defaultValue: defaultTableFieldOptions.align,
        })
        .addCustomEditor<void, TableCellOptions>({
          id: 'cellOptions',
          path: 'cellOptions',
          name: 'Cell type',
          editor: TableCellOptionEditor,
          override: TableCellOptionEditor,
          defaultValue: defaultTableFieldOptions.cellOptions,
          process: identityOverrideProcessor,
          category: cellCategory,
          shouldApply: () => true,
        })
        .addBooleanSwitch({
          path: 'inspect',
          name: 'Cell value inspect',
          description: 'Enable cell value inspection in a modal window',
          defaultValue: false,
          category: cellCategory,
          showIf: (cfg) => {
            return (
              cfg.cellOptions.type === TableCellDisplayMode.Auto ||
              cfg.cellOptions.type === TableCellDisplayMode.JSONView ||
              cfg.cellOptions.type === TableCellDisplayMode.ColorText ||
              cfg.cellOptions.type === TableCellDisplayMode.ColorBackground
            );
          },
        })
        .addBooleanSwitch({
          path: 'filterable',
          name: 'Column filter',
          description: 'Enables/disables field filters in table',
          defaultValue: defaultTableFieldOptions.filterable,
        })
        .addBooleanSwitch({
          path: 'hidden',
          name: 'Hide in table',
          defaultValue: undefined,
          hideFromDefaults: true,
        })
        .addCustomEditor({
          id: 'footer.reducer',
          category: [footerCategory],
          path: 'footer.reducer',
          name: 'Calculation',
          description: 'Choose a reducer function / calculation',
          editor: standardEditorsRegistry.get('stats-picker').editor,
          override: standardEditorsRegistry.get('stats-picker').editor,
          defaultValue: [],
          process: identityOverrideProcessor,
          shouldApply: () => true,
          settings: {
            allowMultiple: true,
          },
        });
    },
  })
  .setPanelOptions((builder) => {
    builder
      .addBooleanSwitch({
        path: 'showHeader',
        name: 'Show table header',
        defaultValue: defaultOptions.showHeader,
      })
      .addRadio({
        path: 'cellHeight',
        name: 'Cell height',
        defaultValue: defaultOptions.cellHeight,
        settings: {
          options: [
            { value: TableCellHeight.Sm, label: 'Small' },
            { value: TableCellHeight.Md, label: 'Medium' },
            { value: TableCellHeight.Lg, label: 'Large' },
          ],
        },
      })
      .addCustomEditor({
        id: 'footer.enablePagination',
        path: 'footer.enablePagination',
        name: 'Enable pagination',
        category: [footerCategory],
        editor: PaginationEditor,
        defaultValue: defaultOptions.footer?.enablePagination,
      });
  })
  .setSuggestionsSupplier(new TableSuggestionsSupplier());
