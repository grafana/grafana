import React, { FC, CSSProperties } from 'react';
import { ReactTableCellProps } from './types';
import { formattedValueToString } from '@grafana/data';
import tinycolor from 'tinycolor2';

export const DefaultCell: FC<ReactTableCellProps> = props => {
  const { column, cell, tableStyles } = props;

  if (!column.field.display) {
    return null;
  }

  const displayValue = column.field.display(cell.value);
  return <div className={tableStyles.tableCell}>{formattedValueToString(displayValue)}</div>;
};

export const BackgroundColoredCell: FC<ReactTableCellProps> = props => {
  const { column, cell, tableStyles } = props;

  if (!column.field.display) {
    return null;
  }

  const themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
  const displayValue = column.field.display(cell.value);

  const bgColor2 = tinycolor(displayValue.color)
    .darken(10 * themeFactor)
    .spin(5)
    .toRgbString();

  const styles: CSSProperties = {
    background: `linear-gradient(120deg, ${bgColor2}, ${displayValue.color})`,
    borderRadius: '0px',
    color: 'white',
    height: tableStyles.cellHeight,
    padding: tableStyles.cellPadding,
  };

  return <div style={styles}>{formattedValueToString(displayValue)}</div>;
};
