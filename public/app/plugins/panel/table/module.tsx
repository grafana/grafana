import {
  clampPanelNaturalHeight,
  identityOverrideProcessor,
  FieldConfigProperty,
  PanelPlugin,
  standardEditorsRegistry,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  TableCellDisplayMode,
  TableCellHeight,
  type TableCellOptions,
  TableCellTooltipPlacement,
  defaultTableFieldOptions,
} from '@grafana/schema';
import { addTableCustomConfig } from 'app/features/panel/table/addTableCustomConfig';
import { addTableCustomPanelOptions } from 'app/features/panel/table/addTableCustomPanelOptions';

import { TableCellOptionEditor } from './TableCellOptionEditor';
import { TablePanel } from './TablePanel';
import { tableMigrationHandler, tablePanelChangedHandler } from './migrations';
import { type FieldConfig, type Options } from './panelcfg.gen';
import { tableSuggestionsSupplier } from './suggestions';

function getTableNoValuePlaceholder(): string {
  return t('table.no-value-placeholder', 'No rows');
}

// Pixel sizes used when computing natural height. Approximate — sufficient
// for layout sizing decisions. Mirrors getDefaultRowHeight in TableNG/utils.
const TABLE_ROW_HEIGHT_SM = 36;
const TABLE_ROW_HEIGHT_MD = 42;
const TABLE_ROW_HEIGHT_LG = 60;
const TABLE_HEADER_HEIGHT = 36;
function getRowPixelHeight(cellHeight: TableCellHeight | undefined): number {
  switch (cellHeight) {
    case TableCellHeight.Sm:
      return TABLE_ROW_HEIGHT_SM;
    case TableCellHeight.Lg:
      return TABLE_ROW_HEIGHT_LG;
    case TableCellHeight.Md:
    default:
      return TABLE_ROW_HEIGHT_MD;
  }
}

export const plugin = new PanelPlugin<Options, FieldConfig>(TablePanel)
  .setPanelChangeHandler(tablePanelChangedHandler)
  .setMigrationHandler(tableMigrationHandler)
  .setNaturalHeight((ctx) => {
    // First series drives the visible row count. Other series are usually
    // rendered as nested tables — we approximate by ignoring them here.
    const rowCount = ctx.data.series[0]?.length ?? 0;
    const rowHeight = getRowPixelHeight(ctx.options.cellHeight);
    const headerHeight = ctx.options.showHeader === false ? 0 : TABLE_HEADER_HEIGHT;
    const inner = headerHeight + rowCount * rowHeight;
    return clampPanelNaturalHeight(inner, ctx);
  })
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Actions]: {
        hideFromDefaults: false,
      },
      [FieldConfigProperty.NoValue]: {
        settings: {
          placeholder: getTableNoValuePlaceholder(),
        },
      },
    },
    useCustomConfig: (builder) => {
      addTableCustomConfig(builder, {
        filters: true,
        wrapHeaderText: true,
        hideFields: true,
      });

      const cellCategory = [t('table.category-cell-options', 'Cell options')];

      builder.addCustomEditor({
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
      });

      builder
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
        })
        .addFieldNamePicker({
          path: 'styleField',
          name: t('table.name-styling-from-field', 'Styling from field'),
          description: t('table.description-styling-from-field', 'A field containing JSON objects with CSS properties'),
          category: cellCategory,
        });
    },
  })
  .setPanelOptions((builder) => {
    addTableCustomPanelOptions(builder);
  })
  .setSuggestionsSupplier(tableSuggestionsSupplier);
