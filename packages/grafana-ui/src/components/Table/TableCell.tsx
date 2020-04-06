import React, { FC } from 'react';
import { Cell } from 'react-table';
import { Field } from '@grafana/data';
import { getTextAlign } from './utils';
import { TableFilterActionCallback } from './types';
import { TableStyles } from './styles';

interface Props {
  cell: Cell;
  field: Field;
  tableStyles: TableStyles;
  onCellClick?: TableFilterActionCallback;
  columnMinWidth?: number;
}

export const TableCell: FC<Props> = ({ cell, field, tableStyles, onCellClick, columnMinWidth }) => {
  const filterable = field.config.filterable;
  const cellProps = cell.getCellProps();

  let onClick: ((event: React.SyntheticEvent) => void) | undefined = undefined;

  if (filterable && onCellClick) {
    if (cellProps.style) {
      cellProps.style.cursor = 'pointer';
    }

    onClick = () => onCellClick(cell.column.Header as string, cell.value);
  }

  const fieldTextAlign = getTextAlign(field);
  if (fieldTextAlign && cellProps.style) {
    cellProps.style.textAlign = fieldTextAlign;
  }

  if (columnMinWidth && cellProps.style) {
    cellProps.style.minWidth = columnMinWidth;
  }

  return (
    <div {...cellProps} onClick={onClick}>
      {cell.render('Cell', { field, tableStyles })}
    </div>
  );
};
