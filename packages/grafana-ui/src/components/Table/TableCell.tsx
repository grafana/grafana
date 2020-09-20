import React, { FC } from 'react';
import { Cell } from 'react-table';
import { Field } from '@grafana/data';
import { TableFilterActionCallback } from './types';
import { TableStyles } from './styles';

export interface Props {
  cell: Cell;
  field: Field;
  tableStyles: TableStyles;
  onCellFilterAdded?: TableFilterActionCallback;
}

export const TableCell: FC<Props> = ({ cell, field, tableStyles, onCellFilterAdded }) => {
  const cellProps = cell.getCellProps();

  if (!field.display) {
    return null;
  }

  if (cellProps.style) {
    cellProps.style.minWidth = cellProps.style.width;
    cellProps.style.justifyContent = (cell.column as any).justifyContent;
  }

  return (
    <>
      {cell.render('Cell', {
        field,
        tableStyles,
        onCellFilterAdded,
        cellProps,
      })}
    </>
  );
};
