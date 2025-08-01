import {
  FieldOverrideContext,
  FieldType,
  getFieldDisplayName,
  PanelPlugin,
  ReducerID,
  standardEditorsRegistry,
  identityOverrideProcessor,
  FieldConfigProperty,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableCellOptions, TableCellDisplayMode, defaultTableFieldOptions, TableCellHeight } from '@grafana/schema';

import { PaginationEditor } from './PaginationEditor';
import { TableCellOptionEditor } from './TableCellOptionEditor';
import { TablePanel } from './TablePanel';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { Options, defaultOptions, FieldConfig } from './panelcfg.gen';
import { TableSuggestionsSupplier } from './suggestions';

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
      const category = [t('table-new.category-table', 'Table')];
      const cellCategory = [t('table-new.category-cell-options', 'Cell options')];
      builder
        .addNumberInput({
          path: 'minWidth',
          name: t('table-new.name-min-column-width', 'Minimum column width'),
          category,
          description: t('table-new.description-min-column-width', 'The minimum width for column auto resizing'),
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
          name: t('table-new.name-column-width', 'Column width'),
          category,
          settings: {
            placeholder: t('table-new.placeholder-column-width', 'auto'),
            min: 20,
          },
          shouldApply: () => true,
          defaultValue: defaultTableFieldOptions.width,
        })
        .addRadio({
          path: 'align',
          name: t('table-new.name-column-alignment', 'Column alignment'),
          category,
          settings: {
            options: [
              { label: t('table-new.column-alignment-options.label-auto', 'Auto'), value: 'auto' },
              { label: t('table-new.column-alignment-options.label-left', 'Left'), value: 'left' },
              { label: t('table-new.column-alignment-options.label-center', 'Center'), value: 'center' },
              { label: t('table-new.column-alignment-options.label-right', 'Right'), value: 'right' },
            ],
          },
          defaultValue: defaultTableFieldOptions.align,
        })
        .addCustomEditor<void, TableCellOptions>({
          id: 'cellOptions',
          path: 'cellOptions',
          name: t('table-new.name-cell-type', 'Cell type'),
          editor: TableCellOptionEditor,
          override: TableCellOptionEditor,
          defaultValue: defaultTableFieldOptions.cellOptions,
          process: identityOverrideProcessor,
          category: cellCategory,
          shouldApply: () => true,
        })
        .addBooleanSwitch({
          path: 'inspect',
          name: t('table-new.name-cell-value-inspect', 'Cell value inspect'),
          description: t('table-new.description-cell-value-inspect', 'Enable cell value inspection in a modal window'),
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
          name: t('table-new.name-column-filter', 'Column filter'),
          category,
          description: t('table-new.description-column-filter', 'Enables/disables field filters in table'),
          defaultValue: defaultTableFieldOptions.filterable,
        })
        .addBooleanSwitch({
          path: 'wrapHeaderText',
          name: t('table.name-wrap-header-text', 'Wrap header text'),
          description: t('table.description-wrap-header-text', 'Enables text wrapping for column headers'),
          category,
          defaultValue: defaultTableFieldOptions.wrapHeaderText,
        })
        .addBooleanSwitch({
          path: 'hidden',
          name: t('table-new.name-hide-in-table', 'Hide in table'),
          category,
          defaultValue: undefined,
          hideFromDefaults: true,
        });
    },
  })
  .setPanelOptions((builder) => {
    const footerCategory = [t('table-new.category-table-footer', 'Table footer')];
    const category = [t('table-new.category-table', 'Table')];
    builder
      .addBooleanSwitch({
        path: 'showHeader',
        name: t('table-new.name-show-table-header', 'Show table header'),
        category,
        defaultValue: defaultOptions.showHeader,
      })
      .addRadio({
        path: 'cellHeight',
        name: t('table-new.name-cell-height', 'Cell height'),
        category,
        defaultValue: defaultOptions.cellHeight,
        settings: {
          options: [
            { value: TableCellHeight.Sm, label: t('table-new.cell-height-options.label-small', 'Small') },
            { value: TableCellHeight.Md, label: t('table-new.cell-height-options.label-medium', 'Medium') },
            { value: TableCellHeight.Lg, label: t('table-new.cell-height-options.label-large', 'Large') },
            { value: TableCellHeight.Auto, label: t('table-new.cell-height-options.label-auto', 'Auto') },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'footer.show',
        category: footerCategory,
        name: t('table-new.name-show-table-footer', 'Show table footer'),
        defaultValue: defaultOptions.footer?.show,
      })
      .addCustomEditor({
        id: 'footer.reducer',
        category: footerCategory,
        path: 'footer.reducer',
        name: t('table-new.name-calculation', 'Calculation'),
        description: t('table-new.description-calculation', 'Choose a reducer function / calculation'),
        editor: standardEditorsRegistry.get('stats-picker').editor,
        defaultValue: [ReducerID.sum],
        showIf: (cfg) => cfg.footer?.show,
      })
      .addBooleanSwitch({
        path: 'footer.countRows',
        category: footerCategory,
        name: t('table-new.name-count-rows', 'Count rows'),
        description: t('table-new.description-count-rows', 'Display a single count for all data rows'),
        defaultValue: defaultOptions.footer?.countRows,
        showIf: (cfg) => cfg.footer?.reducer?.length === 1 && cfg.footer?.reducer[0] === ReducerID.count,
      })
      .addMultiSelect({
        path: 'footer.fields',
        category: footerCategory,
        name: t('table-new.name-fields', 'Fields'),
        description: t('table-new.description-fields', 'Select the fields that should be calculated'),
        settings: {
          allowCustomValue: false,
          options: [],
          placeholder: t('table-new.placeholder-fields', 'All Numeric Fields'),
          getOptions: async (context: FieldOverrideContext) => {
            const options = [];
            if (context && context.data && context.data.length > 0) {
              const frame = context.data[0];
              for (const field of frame.fields) {
                if (field.type === FieldType.number) {
                  const name = getFieldDisplayName(field, frame, context.data);
                  const value = field.name;
                  options.push({ value, label: name });
                }
              }
            }
            return options;
          },
        },
        defaultValue: '',
        showIf: (cfg) => cfg.footer?.show && !(cfg.footer?.countRows && cfg.footer?.reducer.includes(ReducerID.count)),
      })
      .addCustomEditor({
        id: 'footer.enablePagination',
        path: 'footer.enablePagination',
        name: t('table-new.name-enable-pagination', 'Enable pagination'),
        category,
        editor: PaginationEditor,
      });
  })
  .setSuggestionsSupplier(new TableSuggestionsSupplier());
