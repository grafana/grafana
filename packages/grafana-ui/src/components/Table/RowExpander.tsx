import React from 'react';

import { Icon } from '../Icon/Icon';

import { TableStyles } from './styles';
import { GrafanaTableRow } from './types';

export interface Props {
  row: GrafanaTableRow;
  tableStyles: TableStyles;
}

export function RowExpander({ row, tableStyles }: Props) {
  const isExpanded = row.isExpanded;

  return (
    <div className={tableStyles.expanderCell} {...row.getToggleRowExpandedProps()}>
      <Icon
        aria-label={isExpanded ? 'Close trace' : 'Open trace'}
        name={isExpanded ? 'angle-down' : 'angle-right'}
        size="xl"
      />
    </div>
  );
}
