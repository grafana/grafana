import { FieldConfigEditorBuilder, identityOverrideProcessor, standardEditorsRegistry } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  TableCellDisplayMode,
  TableCellOptions,
  TableCellTooltipPlacement,
  TableFieldOptions,
} from '@grafana/schema/dist/esm/common/common.gen';
import { defaultTableFieldOptions } from '@grafana/schema/dist/esm/veneer/common.types';

import { TableCellOptionEditor } from './TableCellOptionEditor';

export function addTableCustomConfig<T extends TableFieldOptions>(builder: FieldConfigEditorBuilder<T>) {
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
    })
    .addFieldNamePicker({
      path: 'styleField',
      name: t('table.name-styling-from-field', 'Styling from field'),
      description: t('table.description-styling-from-field', 'A field containing JSON objects with CSS properties'),
      category: cellCategory,
    });
}
