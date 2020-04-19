import React, { FC } from 'react';
import { TableCellProps } from './types';
import { formattedValueToString } from '@grafana/data';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles } = props;

  if (!field.display) {
    return null;
  }

  const value = field.values.get(cell.row.index);
  const displayValue = field.display(value);
  return <div className={tableStyles.tableCell}>{formattedValueToString(displayValue)}</div>;
};
