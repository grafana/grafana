import React, { FC } from 'react';
import { TableCellProps } from './types';
import { formattedValueToString } from '@grafana/data';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles } = props;

  if (!field.display) {
    return null;
  }

  console.log(cell);
  const displayValue = field.display(field.values.get(cell.row.index));
  return <div className={tableStyles.tableCell}>{formattedValueToString(displayValue)}</div>;
};
