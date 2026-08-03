import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { TableCellHeight, type TableOptions } from '@grafana/schema';
import { defaultOptions as defaultTableOptions } from '@grafana/schema/dist/esm/raw/composable/table/panelcfg/x/TablePanelCfg_types.gen';

import { PaginationEditor } from './PaginationEditor';

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
      // React-only feature toggle, so it is not on config.featureToggles and must be read via the OpenFeature client
      showIf: () => getFeatureFlagClient().getBooleanValue(FlagKeys.TableRowsAsFields, false),
    })
    .addBooleanSwitch({
      path: 'showHeader',
      name: t('table.name-show-table-header', 'Show table header'),
      category,
      defaultValue: defaultTableOptions.showHeader,
      showIf: (opts) => !opts.rowsAsFields,
    })
    .addNumberInput({
      path: 'frozenColumns.left',
      name: t('table.name-frozen-columns', 'Frozen columns'),
      description: t('table.description-frozen-columns', 'Columns are frozen from the left side of the table'),
      settings: {
        placeholder: t('table.placeholder-frozen-columns', 'none'),
      },
      category,
      showIf: (opts) => !opts.rowsAsFields,
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
