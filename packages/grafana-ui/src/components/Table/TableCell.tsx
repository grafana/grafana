import React, { FC } from 'react';
import { Cell } from 'react-table';
import { Field } from '@grafana/data';

import { getTextAlign } from './utils';
import { TableCellClickActionCallback, TableFilterActionCallback } from './types';
import { TableStyles } from './styles';
import { ClickableTableCell } from './ClickableTableCell';
import { FilterableTableCell } from './FilterableTableCell';

export interface Props {
  cell: Cell;
  field: Field;
  tableStyles: TableStyles;
  onCellClick?: TableCellClickActionCallback;
  onFilterAdded?: TableFilterActionCallback;
}

export const TableCell: FC<Props> = ({ cell, field, tableStyles, onCellClick, onFilterAdded }) => {
  const filterable = field.config.filterable;
  const cellProps = cell.getCellProps();

  if (cellProps.style) {
    cellProps.style.textAlign = getTextAlign(field);
  }

  if (filterable && onCellClick) {
    return (
      <ClickableTableCell
        cell={cell}
        field={field}
        tableStyles={tableStyles}
        onCellClick={onCellClick}
        cellProps={cellProps}
      />
    );
  }

  if (filterable && onFilterAdded) {
    return (
      <FilterableTableCell
        cell={cell}
        field={field}
        tableStyles={tableStyles}
        onFilterAdded={onFilterAdded}
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
