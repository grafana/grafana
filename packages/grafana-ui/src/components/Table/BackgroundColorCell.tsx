import React, { FC } from 'react';
import { TableCellProps } from './types';
import { DefaultCell } from './DefaultCell';
import { Field } from '@grafana/data';
import { Cell } from 'react-table';
import { TableStyles } from './styles';
import tinycolor from 'tinycolor2';
import { css } from 'emotion';

export const BackgroundColoredCell: FC<TableCellProps> = props => {
  return <DefaultCell {...props} getExtendedStyle={getBackgroundColorStyle} />;
};

function getBackgroundColorStyle(field: Field, cell: Cell, tableStyles: TableStyles) {
  if (!field.display) {
    return tableStyles.tableCell;
  }

  const themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
  const displayValue = field.display(cell.value);

  const bgColor2 = tinycolor(displayValue.color)
    .darken(10 * themeFactor)
    .spin(5)
    .toRgbString();

  return css`
    background: linear-gradient(120deg, ${bgColor2}, ${displayValue.color});
    color: white;
    height: ${tableStyles.cellHeight}px;
    padding: ${tableStyles.cellPadding}px;
  `;
}
