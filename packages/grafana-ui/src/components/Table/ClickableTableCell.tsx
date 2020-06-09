import { TableCellClickActionCallback } from './types';
import { TableCellProps } from 'react-table';
import React, { FC, useCallback } from 'react';
import { Props, renderCell } from './TableCell';

interface ClickableTableCellProps extends Pick<Props, 'cell' | 'field' | 'tableStyles'> {
  onCellClick: TableCellClickActionCallback;
  cellProps: TableCellProps;
}

export const ClickableTableCell: FC<ClickableTableCellProps> = ({
  cell,
  field,
  tableStyles,
  onCellClick,
  cellProps,
}) => {
  const onClick = useCallback(() => onCellClick(cell.column.Header as string, cell.value), [cell, onCellClick]);
  if (cellProps.style) {
    cellProps.style.cursor = 'pointer';
  }

  return (
    <div {...cellProps} onClick={onClick} className={tableStyles.tableCellWrapper}>
      {renderCell(cell, field, tableStyles)}
    </div>
  );
};
