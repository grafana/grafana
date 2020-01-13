import React, { CSSProperties, FC } from 'react';
import { TableCellProps } from './types';
import tinycolor from 'tinycolor2';
import { formattedValueToString } from '@grafana/data';

export const BackgroundColoredCell: FC<TableCellProps> = props => {
  const { cell, tableStyles, field } = props;

  if (!field.display) {
    return null;
  }

  const themeFactor = tableStyles.theme.isDark ? 1 : -0.7;
  const displayValue = field.display(cell.value);

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
