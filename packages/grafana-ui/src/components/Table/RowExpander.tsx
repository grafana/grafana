import React from 'react';

import { Icon } from '../Icon/Icon';

import { TableStyles } from './styles';
import { GrafanaTableRow } from './types';

export interface Props {
  row: GrafanaTableRow;
  tableStyles: TableStyles;
}

export function RowExpander({ row, tableStyles }: Props) {
  return (
    <div className={tableStyles.expanderCell} {...row.getToggleRowExpandedProps()}>
      <Icon
        aria-label={row.isExpanded ? 'Close trace' : 'Open trace'}
        name={row.isExpanded ? 'angle-down' : 'angle-right'}
        size="xl"
      />
    </div>
  );
}
