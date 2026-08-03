import { type DataFrame, FieldType, type PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { TableCellHeight, type TableOptions } from '@grafana/schema';
import { defaultOptions as defaultTableOptions } from '@grafana/schema/dist/esm/raw/composable/table/panelcfg/x/TablePanelCfg_types.gen';

import { PaginationEditor } from './PaginationEditor';

// Nested frames route to the nested table, which is mutually exclusive with rows-as-fields. We don't
// pivot nested data (that would mean inventing nested columns), so treat rows-as-fields as unavailable
// whenever any frame carries a nested-frames field.
const hasNestedFrames = (data?: DataFrame[]): boolean =>
  data?.some((frame) => frame.fields.some((field) => field.type === FieldType.nestedFrames)) ?? false;

// Whether the rows-as-fields render path is actually in effect: the toggle is on, the option is set,
// and the data is not nested. Editors that rows-as-fields disables (frozen columns, header) key off
// this so they stay visible when the table still renders normally (e.g. nested data, or toggle off).
const rowsAsFieldsActive = (opts: TableOptions, data?: DataFrame[]): boolean =>
  Boolean(opts.rowsAsFields) &&
  !hasNestedFrames(data) &&
  getFeatureFlagClient().getBooleanValue(FlagKeys.TableRowsAsFields, false);

export const addTableCustomPanelOptions = <O extends TableOptions>(builder: PanelOptionsEditorBuilder<O>) => {
  const category = [t('table.category-table', 'Table')];
  builder
    .addBooleanSwitch({
      path: 'rowsAsFields',
      name: t('table.name-rows-as-fields', 'Rows as fields'),
      description: t(
        'table.description-rows-as-fields',
        'Render each field as a row (pivoted). The first column is a frozen list of field names. Header, sorting, filtering, and footers are disabled in this mode.'
      ),
      category,
      defaultValue: defaultTableOptions.rowsAsFields,
      // React-only feature toggle (not on config.featureToggles, read via the OpenFeature client). Also
      // hidden when nested frames are present, since those render as a nested table, not a pivoted one.
      showIf: (_opts, data) =>
        getFeatureFlagClient().getBooleanValue(FlagKeys.TableRowsAsFields, false) && !hasNestedFrames(data),
    })
    .addBooleanSwitch({
      path: 'showHeader',
      name: t('table.name-show-table-header', 'Show table header'),
      category,
      defaultValue: defaultTableOptions.showHeader,
      showIf: (opts, data) => !rowsAsFieldsActive(opts, data),
    })
    .addNumberInput({
      path: 'frozenColumns.left',
      name: t('table.name-frozen-columns', 'Frozen columns'),
      description: t('table.description-frozen-columns', 'Columns are frozen from the left side of the table'),
      settings: {
        placeholder: t('table.placeholder-frozen-columns', 'none'),
      },
      category,
      showIf: (opts, data) => !rowsAsFieldsActive(opts, data),
    })
    .addRadio({
      path: 'cellHeight',
      name: t('table.name-cell-height', 'Cell height'),
      category,
      defaultValue: defaultTableOptions.cellHeight,
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
      defaultValue: defaultTableOptions?.enablePagination,
    })
    .addNumberInput({
      path: 'pageSize',
      name: t('table.name-page-size', 'Page size'),
      description: t(
        'table.description-page-size',
        'Number of rows per page. When empty, the page size is based on the panel height.'
      ),
      category,
      settings: {
        placeholder: t('table.placeholder-page-size', 'auto'),
        min: 1,
        integer: true,
      },
      // React-only feature toggle, so it is not on config.featureToggles and must be read via the OpenFeature client
      showIf: (opts) =>
        Boolean(opts.enablePagination) &&
        getFeatureFlagClient().getBooleanValue(FlagKeys.TablePaginationPageSize, false),
    });
};
