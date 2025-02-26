import { Icon } from '../../Icon/Icon';
import { GrafanaTableRow } from '../types';

import { TableStyles } from './styles';

export interface Props {
  row: GrafanaTableRow;
  tableStyles: TableStyles;
}

export function RowExpander({ row, tableStyles }: Props) {
  return (
    <div className={tableStyles.expanderCell} {...row.getToggleRowExpandedProps()}>
      <Icon
        aria-label={row.isExpanded ? 'Collapse row' : 'Expand row'}
        name={row.isExpanded ? 'angle-down' : 'angle-right'}
        size="lg"
      />
    </div>
  );
}
