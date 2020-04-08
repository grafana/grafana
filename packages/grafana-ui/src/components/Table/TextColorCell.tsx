import React, { FC } from 'react';
import { css } from 'emotion';
import { Field } from '@grafana/data';

import { TableCellProps } from './types';
import { DefaultCell } from './DefaultCell';
import { Cell } from 'react-table';
import { TableStyles } from './styles';

export const TextColorCell: FC<TableCellProps> = props => {
  return <DefaultCell {...props} getExtendedStyle={getTextColorStyle} />;
};

function getTextColorStyle(field: Field, cell: Cell, tableStyles: TableStyles) {
  if (!field.display) {
    return tableStyles.tableCell;
  }

  const displayValue = field.display(cell.value);
  if (!displayValue.color) {
    return tableStyles.tableCell;
  }

  return css`
    color: ${displayValue.color};
  `;
}
