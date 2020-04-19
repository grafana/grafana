import React, { FC } from 'react';
import { TableCellProps } from './types';
import { formattedValueToString } from '@grafana/data';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles } = props;

  if (!field.display) {
    return null;
  }

  const displayValue = field.display(cell.value);
  return <div className={tableStyles.tableCell}>{formattedValueToString(displayValue)}</div>;
};
