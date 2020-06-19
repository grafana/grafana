import React, { FC } from 'react';
import { Cell } from 'react-table';
import { Field } from '@grafana/data';

import { getTextAlign } from './utils';
import { TableFilterActionCallback } from './types';
import { TableStyles } from './styles';
import { FilterableTableCell } from './FilterableTableCell';

export interface Props {
  cell: Cell;
  field: Field;
  tableStyles: TableStyles;
  onCellFilterAdded?: TableFilterActionCallback;
}

export const TableCell: FC<Props> = ({ cell, field, tableStyles, onCellFilterAdded }) => {
  const filterable = field.config.filterable;
  const cellProps = cell.getCellProps();

  if (cellProps.style) {
    cellProps.style.textAlign = getTextAlign(field);
  }

  if (filterable && onCellFilterAdded) {
    return (
      <FilterableTableCell
        cell={cell}
        field={field}
        tableStyles={tableStyles}
        onCellFilterAdded={onCellFilterAdded}
        cellProps={cellProps}
      />
    );
  }

  return (
    <div {...cellProps} className={tableStyles.tableCellWrapper}>
      {renderCell(cell, field, tableStyles)}
    </div>
  );
};

export const renderCell = (cell: Cell, field: Field, tableStyles: TableStyles) =>
  cell.render('Cell', { field, tableStyles });
