import React, { FC } from 'react';
import { DisplayValue, Field } from '@grafana/data';
import { TableStyles } from './styles';
import { TableCellProps } from './types';

export const SVGCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles, cellProps } = props;

  const displayValue = field.display!(cell.value);

  const cellStyle = getCellStyle(tableStyles, field, displayValue);

  return (
    <div
      {...cellProps}
      className={cellStyle + ' ' + tableStyles.imageCell}
      dangerouslySetInnerHTML={{ __html: displayValue.text }}
    ></div>
  );
};

function getCellStyle(tableStyles: TableStyles, field: Field, displayValue: DisplayValue) {
  return tableStyles.buildCellContainerStyle(displayValue.color);
}
