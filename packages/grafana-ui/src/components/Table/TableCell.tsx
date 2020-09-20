import React, { FC } from 'react';
import { Cell } from 'react-table';
import { Field } from '@grafana/data';
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
      {cell.render('Cell', { field, tableStyles })}
    </div>
  );
};
