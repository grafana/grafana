import { type Cell } from '@tanstack/react-table';
import { type CSSProperties, type HTMLAttributes } from 'react';

import { type TimeRange, type DataFrame, type InterpolateFunction } from '@grafana/data';

import { type TableStyles } from '../TableRT/styles';
import {
  type GetActionsFunction,
  type TableCellUserProps,
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
  userProps?: TableCellUserProps;
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
  const { field, justifyContent, cellComponent: CellComponent } = cell.column.columnDef.meta ?? {};
  const cellProps: HTMLAttributes<HTMLDivElement> = {
    role: 'cell',
    style: cellStyle ?? {
      position: 'absolute',
      left: cell.column.getStart(),
      width: cell.column.getSize(),
    },
  };

  if (!field?.display || !CellComponent) {
    return null;
  }

  if (cellProps.style) {
    cellProps.style.wordBreak = 'break-word';
    cellProps.style.minWidth = cellProps.style.width;

    if (justifyContent === 'flex-end' && !field.config.unit) {
      // justify-content flex-end is not compatible with cellLink overflow; use direction instead
      cellProps.style.textAlign = 'right';
      cellProps.style.direction = 'rtl';
      cellProps.style.unicodeBidi = 'plaintext';
    } else {
      cellProps.style.justifyContent = justifyContent;
    }
  }

  const innerWidth = cell.column.getSize() - tableStyles.cellPadding * 2;
  const actions = getActions ? getActions(frame, field, cell.row.index, replaceVariables) : [];

  return (
    <CellComponent
      {...cell.getContext()}
      cell={{ ...cell, value: cell.getValue() }}
      field={field}
      tableStyles={tableStyles}
      onCellFilterAdded={onCellFilterAdded}
      cellProps={cellProps}
      innerWidth={innerWidth}
      timeRange={timeRange}
      userProps={userProps}
      frame={frame}
      rowStyled={rowStyled}
      rowExpanded={rowExpanded}
      textWrapped={textWrapped}
      height={height}
      actions={actions}
      setInspectCell={setInspectCell}
    />
  );
};
