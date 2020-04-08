import React, { FC } from 'react';
import { TableCellProps } from './types';
import { formattedValueToString } from '@grafana/data';
import { css } from 'emotion';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles, getExtendedStyle } = props;

  if (!field.display) {
    return null;
  }

  const displayValue = field.display(cell.value);
  const className = css`
    ${tableStyles.tableCell};
    ${getExtendedStyle ? getExtendedStyle(field, cell, tableStyles) : undefined};
  `;

  return <div className={className}>{formattedValueToString(displayValue)}</div>;
};
