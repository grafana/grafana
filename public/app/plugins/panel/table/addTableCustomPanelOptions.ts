import { PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TableCellHeight } from '@grafana/schema/dist/esm/common/common.gen';

import { PaginationEditor } from './PaginationEditor';
import { defaultOptions, Options } from './panelcfg.gen';

export const addTableCustomPanelOptions = (builder: PanelOptionsEditorBuilder<Options>) => {
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
};
