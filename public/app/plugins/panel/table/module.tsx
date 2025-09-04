import { PanelPlugin, standardEditorsRegistry, identityOverrideProcessor, FieldConfigProperty } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  defaultTableFieldOptions,
  TableCellOptions,
  TableCellDisplayMode,
  TableCellHeight,
  TableCellTooltipPlacement,
} from '@grafana/schema';

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
      const category = [t('table.category-table', 'Table')];
      const cellCategory = [t('table.category-cell-options', 'Cell options')];
      builder
        .addNumberInput({
          path: 'minWidth',
          name: t('table.name-min-column-width', 'Minimum column width'),
          category,
          description: t('table.description-min-column-width', 'The minimum width for column auto resizing'),
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
          name: t('table.name-column-width', 'Column width'),
          category,
          settings: {
            placeholder: t('table.placeholder-column-width', 'auto'),
            min: 20,
          },
          shouldApply: () => true,
          defaultValue: defaultTableFieldOptions.width,
        })
        .addRadio({
          path: 'align',
          name: t('table.name-column-alignment', 'Column alignment'),
          category,
          settings: {
            options: [
              { label: t('table.column-alignment-options.label-auto', 'Auto'), value: 'auto' },
              { label: t('table.column-alignment-options.label-left', 'Left'), value: 'left' },
              { label: t('table.column-alignment-options.label-center', 'Center'), value: 'center' },
              { label: t('table.column-alignment-options.label-right', 'Right'), value: 'right' },
            ],
          },
          defaultValue: defaultTableFieldOptions.align,
        })
        .addBooleanSwitch({
          path: 'filterable',
          name: t('table.name-column-filter', 'Column filter'),
          category,
          description: t('table.description-column-filter', 'Enables/disables field filters in table'),
          defaultValue: defaultTableFieldOptions.filterable,
        })
        .addBooleanSwitch({
          path: 'wrapText',
          name: t('table.name-wrap-text', 'Wrap text'),
          category,
        })
        .addBooleanSwitch({
          path: 'wrapHeaderText',
          name: t('table.name-wrap-header-text', 'Wrap header text'),
          category,
        })
        .addBooleanSwitch({
          path: 'hideFrom.viz',
          name: t('table.name-hide-in-table', 'Hide in table'),
          category,
          defaultValue: undefined,
          hideFromDefaults: true,
        })
        .addCustomEditor({
          id: 'footer.reducers',
          category: [t('table.category-table-footer', 'Table footer')],
          path: 'footer.reducers',
          name: t('table.name-calculation', 'Calculation'),
          description: t('table.description-calculation', 'Choose a reducer function / calculation'),
          editor: standardEditorsRegistry.get('stats-picker').editor,
          override: standardEditorsRegistry.get('stats-picker').editor,
          defaultValue: [],
          process: identityOverrideProcessor,
          shouldApply: () => true,
          settings: {
            allowMultiple: true,
          },
        })
        .addCustomEditor<void, TableCellOptions>({
          id: 'cellOptions',
          path: 'cellOptions',
          name: t('table.name-cell-type', 'Cell type'),
          editor: TableCellOptionEditor,
          override: TableCellOptionEditor,
          defaultValue: defaultTableFieldOptions.cellOptions,
          process: identityOverrideProcessor,
          category: cellCategory,
          shouldApply: () => true,
        })
        .addBooleanSwitch({
          path: 'inspect',
          name: t('table.name-cell-value-inspect', 'Cell value inspect'),
          description: t('table.description-cell-value-inspect', 'Enable cell value inspection in a modal window'),
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
        .addFieldNamePicker({
          path: 'tooltip.field',
          name: t('table.name-tooltip-from-field', 'Tooltip from field'),
          description: t(
            'table.description-tooltip-from-field',
            'Render a cell from a field (hidden or visible) in a tooltip'
          ),
          category: cellCategory,
        })
        .addSelect({
          path: 'tooltip.placement',
          name: t('table.name-tooltip-placement', 'Tooltip placement'),
          category: cellCategory,
          settings: {
            options: [
              {
                label: t('table.tooltip-placement-options.label-auto', 'Auto'),
                value: TableCellTooltipPlacement.Auto,
              },
              {
                label: t('table.tooltip-placement-options.label-top', 'Top'),
                value: TableCellTooltipPlacement.Top,
              },
              {
                label: t('table.tooltip-placement-options.label-right', 'Right'),
                value: TableCellTooltipPlacement.Right,
              },
              {
                label: t('table.tooltip-placement-options.label-bottom', 'Bottom'),
                value: TableCellTooltipPlacement.Bottom,
              },
              {
                label: t('table.tooltip-placement-options.label-left', 'Left'),
                value: TableCellTooltipPlacement.Left,
              },
            ],
          },
          showIf: (cfg) => cfg.tooltip?.field !== undefined,
        });
    },
  })
  .setPanelOptions((builder) => {
    const category = [t('table.category-table', 'Table')];
    builder
      .addBooleanSwitch({
        path: 'showHeader',
        name: t('table.name-show-table-header', 'Show table header'),
        category,
        defaultValue: defaultOptions.showHeader,
      })
      .addNumberInput({
        path: 'frozenColumns.left',
        name: t('table.name-frozen-columns', 'Frozen columns'),
        description: t('table.description-frozen-columns', 'Columns are frozen from the left side of the table'),
        settings: {
          placeholder: 'none',
        },
        category,
      })
      .addRadio({
        path: 'cellHeight',
        name: t('table.name-cell-height', 'Cell height'),
        category,
        defaultValue: defaultOptions.cellHeight,
        settings: {
          options: [
            { value: TableCellHeight.Sm, label: t('table.cell-height-options.label-small', 'Small') },
            { value: TableCellHeight.Md, label: t('table.cell-height-options.label-medium', 'Medium') },
            { value: TableCellHeight.Lg, label: t('table.cell-height-options.label-large', 'Large') },
          ],
        },
      })
      .addNumberInput({
        path: 'maxRowHeight',
        name: t('table.name-max-height', 'Max row height'),
        category,
        settings: {
          placeholder: t('table.placeholder-max-height', 'none'),
          min: 0,
        },
      })
      .addCustomEditor({
        id: 'enablePagination',
        path: 'enablePagination',
        name: t('table.name-enable-pagination', 'Enable pagination'),
        category,
        editor: PaginationEditor,
        defaultValue: defaultOptions?.enablePagination,
      });
  })
  .setSuggestionsSupplier(new TableSuggestionsSupplier());
