import React, { FC } from 'react';
import { ReactTableCellProps } from './types';
import { formattedValueToString } from '@grafana/data';

export const DefaultCell: FC<ReactTableCellProps> = props => {
  const { column, cell } = props;

  if (column.field.display) {
    const displayValue = column.field.display(cell.value);
    return <span>{formattedValueToString(displayValue)}</span>;
  }

  return <span>{cell.value}</span>;
};
