import { t } from '@grafana/i18n';

import { Icon } from '../../Icon/Icon';
import { type GrafanaTableRow, type TableCellProps } from '../types';

import { type TableStyles } from './styles';

export interface Props {
  row: GrafanaTableRow;
  tableStyles: TableStyles;
  cellProps?: TableCellProps['cellProps'];
}

export function RowExpander({ row, tableStyles, cellProps }: Props) {
  return (
    <div
      className={tableStyles.expanderCell}
      role="cell"
      aria-colindex={cellProps?.['aria-colindex']}
      {...row.getToggleRowExpandedProps()}
    >
      <Icon
        aria-label={
          row.isExpanded
            ? t('grafana-ui.row-expander.collapse', 'Collapse row')
            : t('grafana-ui.row-expander.expand', 'Expand row')
        }
        name={row.isExpanded ? 'angle-down' : 'angle-right'}
        size="lg"
      />
    </div>
  );
}
