import React from 'react';
import { Cell } from 'react-table';

import { TimeRange, DataFrame } from '@grafana/data';

import { TableStyles } from './styles';
import { GrafanaTableColumn, TableFilterActionCallback } from './types';

export interface Props {
  cell: Cell;
  tableStyles: TableStyles;
  onCellFilterAdded?: TableFilterActionCallback;
  columnIndex: number;
  columnCount: number;
  timeRange?: TimeRange;
  userProps?: object;
  frame: DataFrame;
  disableVirtualization: boolean;
}

export const TableCell = ({
  cell,
  tableStyles,
  onCellFilterAdded,
  timeRange,
  userProps,
  frame,
  disableVirtualization,
}: Props) => {
  const cellProps = cell.getCellProps();
  const field = (cell.column as unknown as GrafanaTableColumn).field;

  if (!field?.display) {
    return null;
  }

  if (cellProps.style) {
    cellProps.style.minWidth = cellProps.style.width;
    cellProps.style.justifyContent = (cell.column as any).justifyContent;

    if (disableVirtualization) {
      cellProps.style.position = 'relative';
      cellProps.style.left = undefined;
    }
  }

  let innerWidth = (typeof cell.column.width === 'number' ? cell.column.width : 24) - tableStyles.cellPadding * 2;

  return (
    <>
      {cell.render('Cell', {
        field,
        tableStyles,
        onCellFilterAdded,
        cellProps,
        innerWidth,
        timeRange,
        userProps,
        frame,
      })}
    </>
  );
};
