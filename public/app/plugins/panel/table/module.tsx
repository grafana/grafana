import {
  FieldOverrideContext,
  FieldType,
  getFieldDisplayName,
  PanelPlugin,
  ReducerID,
  standardEditorsRegistry,
  identityOverrideProcessor,
} from '@grafana/data';
import { TableFieldOptions, TableCellOptions } from '@grafana/schema';
import { TableCellDisplayMode } from '@grafana/ui';

import { PaginationEditor } from './PaginationEditor';
import { TableCellOptionEditor } from './TableCellOptionEditor';
import { TablePanel } from './TablePanel';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { PanelOptions, defaultPanelOptions, defaultPanelFieldConfig } from './models.gen';
import { TableSuggestionsSupplier } from './suggestions';

const footerCategory = 'Table footer';
const cellCategory = ['Cell Options'];

export const plugin = new PanelPlugin<PanelOptions, TableFieldOptions>(TablePanel)
  .setPanelChangeHandler(tablePanelChangedHandler)
  .setMigrationHandler(tableMigrationHandler)
  .setNoPadding()
  .useFieldConfig({
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
          defaultValue: defaultPanelFieldConfig.minWidth,
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
          defaultValue: defaultPanelFieldConfig.width,
        })
        .addRadio({
          path: 'align',
          name: 'Column alignment',
          settings: {
            options: [
              { label: 'auto', value: 'auto' },
              { label: 'left', value: 'left' },
              { label: 'center', value: 'center' },
              { label: 'right', value: 'right' },
            ],
          },
          defaultValue: defaultPanelFieldConfig.align,
        })
        // .addSelect({
        //   path: 'cellOptions.displayMode',
        //   name: 'Cell display mode',
        //   description: 'Color text, background, show as gauge, etc',
        //   settings: {
        //     options: [
        //       { value: TableCellDisplayMode.Auto, label: 'Auto' },
        //       { value: TableCellDisplayMode.ColorText, label: 'Colored text' },
        //       { value: TableCellDisplayMode.ColorBackground, label: 'Colored background' },
        //       { value: TableCellDisplayMode.Gauge, label: 'Gauge' },
        //       { value: TableCellDisplayMode.JSONView, label: 'JSON View' },
        //       { value: TableCellDisplayMode.Image, label: 'Image' },
        //     ],
        //   },

        //   defaultValue: defaultPanelFieldConfig.cellOptions.displayMode,
        //   category: cellCategory,
        // })
        .addCustomEditor<void, TableCellOptions>({
          id: 'cellOptions',
          path: 'cellOptions',
          name: 'Cell Options',
          editor: TableCellOptionEditor,
          override: TableCellOptionEditor,
          defaultValue: {
            displayMode: defaultPanelFieldConfig.cellOptions.displayMode,
            subOptions: {},
          },
          process: identityOverrideProcessor,
          category: cellCategory,
          shouldApply: (f) => true,
          showIf: (cfg) => {
            return true;
          },
        })
        // .addSelect({
        //   path: 'cellOptions.gaugeDisplayMode',
        //   name: 'Display type',
        //   description: 'The type background or gauge (gradient, retro, etc.) to display',
        //   defaultValue: BarGaugeDisplayMode.Basic,
        //   settings: {
        //     options: [
        //       { value: BarGaugeDisplayMode.Basic, label: 'Basic' },
        //       { value: BarGaugeDisplayMode.Gradient, label: 'Gradient' },
        //       { value: BarGaugeDisplayMode.Lcd, label: 'Retro LCD' },
        //     ],
        //   },
        //   showIf: (cfg) => cfg.cellOptions.displayMode === TableCellDisplayMode.Gauge,
        // })
        // .addSelect({
        //   path: 'cellOptions.backgroundDisplayMode',
        //   name: 'Background Type',
        //   description: 'The type of background to display',
        //   defaultValue: BackgroundDisplayMode.Basic,
        //   settings: {
        //     options: [
        //       { value: BackgroundDisplayMode.Basic, label: 'Basic' },
        //       { value: BackgroundDisplayMode.Gradient, label: 'Gradient' },
        //     ],
        //   },
        //   showIf: (cfg) => cfg.cellOptions.displayMode === TableCellDisplayMode.ColorBackground,
        // })
        .addBooleanSwitch({
          path: 'inspect',
          name: 'Cell value inspect',
          description: 'Enable cell value inspection in a modal window',
          defaultValue: false,
          showIf: (cfg) => {
            return (
              cfg.cellOptions.displayMode === TableCellDisplayMode.Auto ||
              cfg.cellOptions.displayMode === TableCellDisplayMode.JSONView ||
              cfg.cellOptions.displayMode === TableCellDisplayMode.ColorText ||
              cfg.cellOptions.displayMode === TableCellDisplayMode.ColorBackground
            );
          },
        })
        .addBooleanSwitch({
          path: 'filterable',
          name: 'Column filter',
          description: 'Enables/disables field filters in table',
          defaultValue: defaultPanelFieldConfig.filterable,
        })
        .addBooleanSwitch({
          path: 'hidden',
          name: 'Hide in table',
          defaultValue: undefined,
          hideFromDefaults: true,
        });
    },
  })
  .setPanelOptions((builder) => {
    builder
      .addBooleanSwitch({
        path: 'showHeader',
        name: 'Show table header',
        defaultValue: defaultPanelOptions.showHeader,
      })
      .addBooleanSwitch({
        path: 'footer.show',
        category: [footerCategory],
        name: 'Show table footer',
        defaultValue: defaultPanelOptions.footer?.show,
      })
      .addCustomEditor({
        id: 'footer.reducer',
        category: [footerCategory],
        path: 'footer.reducer',
        name: 'Calculation',
        description: 'Choose a reducer function / calculation',
        editor: standardEditorsRegistry.get('stats-picker').editor as any,
        defaultValue: [ReducerID.sum],
        showIf: (cfg) => cfg.footer?.show,
      })
      .addMultiSelect({
        path: 'footer.fields',
        category: [footerCategory],
        name: 'Fields',
        description: 'Select the fields that should be calculated',
        settings: {
          allowCustomValue: false,
          options: [],
          placeholder: 'All Numeric Fields',
          getOptions: async (context: FieldOverrideContext) => {
            const options = [];
            if (context && context.data && context.data.length > 0) {
              const frame = context.data[0];
              for (const field of frame.fields) {
                if (field.type === FieldType.number) {
                  const name = getFieldDisplayName(field, frame, context.data);
                  const value = field.name;
                  options.push({ value, label: name } as any);
                }
              }
            }
            return options;
          },
        },
        defaultValue: '',
        showIf: (cfg) => cfg.footer?.show,
      })
      .addCustomEditor({
        id: 'footer.enablePagination',
        path: 'footer.enablePagination',
        name: 'Enable pagination',
        editor: PaginationEditor,
      });
  })
  .setSuggestionsSupplier(new TableSuggestionsSupplier());
