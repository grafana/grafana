import { flexRender, type Cell } from '@tanstack/react-table';
import { type CSSProperties, type HTMLAttributes } from 'react';

import { type TimeRange, type DataFrame, type InterpolateFunction } from '@grafana/data';

import { type TableStyles } from '../TableRT/styles';
import {
  type GetActionsFunction,
  type GrafanaTableColumn,
  type TableFilterActionCallback,
  type TableInspectCellCallback,
} from '../types';

export interface Props {
  cell: Cell<unknown, unknown>;
  tableStyles: TableStyles;
  onCellFilterAdded?: TableFilterActionCallback;
  columnIndex: number;
  columnCount: number;
  timeRange?: TimeRange;
  userProps?: object;
  cellStyle?: CSSProperties;
  frame: DataFrame;
  rowStyled?: boolean;
  rowExpanded?: boolean;
  textWrapped?: boolean;
  height?: number;
  getActions?: GetActionsFunction;
  replaceVariables?: InterpolateFunction;
  setInspectCell?: TableInspectCellCallback;
}

export const TableCell = ({
  cell,
  tableStyles,
  onCellFilterAdded,
  timeRange,
  userProps,
  cellStyle,
  frame,
  rowStyled,
  rowExpanded,
  textWrapped,
  height,
  getActions,
  replaceVariables,
  setInspectCell,
}: Props) => {
  const columnDef = cell.column.columnDef as GrafanaTableColumn;
  const cellProps: HTMLAttributes<HTMLDivElement> = {
    style: {
      ...(cellStyle ?? {
        position: 'absolute',
        left: cell.column.getStart(),
        width: cell.column.getSize(),
      }),
    },
  };
  const field = columnDef.field;

  if (!field?.display) {
    return null;
  }

  if (cellProps.style) {
    cellProps.style.wordBreak = 'break-word';
    cellProps.style.minWidth = cellProps.style.width;
    const justifyContent = columnDef.justifyContent;

    if (justifyContent === 'flex-end' && !field.config.unit) {
      // justify-content flex-end is not compatible with cellLink overflow; use direction instead
      cellProps.style.textAlign = 'right';
      cellProps.style.direction = 'rtl';
      cellProps.style.unicodeBidi = 'plaintext';
    } else {
      cellProps.style.justifyContent = justifyContent;
    }
  }

  let innerWidth = cell.column.getSize() - tableStyles.cellPadding * 2;

  const actions = getActions ? getActions(frame, field, cell.row.index, replaceVariables) : [];

  return (
    <>
      {flexRender(columnDef.cell, {
        ...cell.getContext(),
        cell: Object.assign(cell, { value: cell.getValue() }),
        field,
        tableStyles,
        onCellFilterAdded,
        cellProps,
        innerWidth,
        timeRange,
        userProps,
        frame,
        rowStyled,
        rowExpanded,
        textWrapped,
        height,
        actions,
        setInspectCell,
      })}
    </>
  );
};
