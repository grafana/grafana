import React, { FC } from 'react';
import { css } from 'emotion';
import { formattedValueToString } from '@grafana/data';

import { TableCellProps } from './types';

export const TextColorCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles } = props;

  if (!field.display) {
    return null;
  }

  const displayValue = field.display(cell.value);

  if (!displayValue.color) {
    return <div className={tableStyles.tableCell}>{formattedValueToString(displayValue)}</div>;
  }

  const style = css`
    ${tableStyles.tableCell};
    color: ${displayValue.color};
  `;

  return <div className={style}>{formattedValueToString(displayValue)}</div>;
};
