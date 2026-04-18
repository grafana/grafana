import { type Cell } from 'react-table';

import { type TimeRange, type DataFrame, type InterpolateFunction } from '@grafana/data';

import { type TableStyles } from '../TableRT/styles';
import {
  type GetActionsFunction,
  type GrafanaTableColumn,
  type TableFilterActionCallback,
  type TableInspectCellCallback,
} from '../types';

export interface SelectionEdges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface Props {
  cell: Cell;
  tableStyles: TableStyles;
  onCellFilterAdded?: TableFilterActionCallback;
  columnIndex: number;
  columnCount: number;
  timeRange?: TimeRange;
  userProps?: object;
  frame: DataFrame;
  rowStyled?: boolean;
  rowExpanded?: boolean;
  textWrapped?: boolean;
  height?: number;
  getActions?: GetActionsFunction;
  replaceVariables?: InterpolateFunction;
  setInspectCell?: TableInspectCellCallback;
  selectionEdges?: SelectionEdges | null;
  onCellMouseDown?: (event: React.MouseEvent) => void;
  onCellMouseEnter?: () => void;
}

export const TableCell = ({
  cell,
  tableStyles,
  onCellFilterAdded,
  timeRange,
  userProps,
  frame,
  rowStyled,
  rowExpanded,
  textWrapped,
  height,
  getActions,
  replaceVariables,
  setInspectCell,
  selectionEdges,
  onCellMouseDown,
  onCellMouseEnter,
}: Props) => {
  const cellProps = cell.getCellProps();
  const field = (cell.column as unknown as GrafanaTableColumn).field;

  if (!field?.display) {
    return null;
  }

  if (cellProps.style) {
    cellProps.style.wordBreak = 'break-word';
    cellProps.style.minWidth = cellProps.style.width;
    const justifyContent = (cell.column as any).justifyContent;

    if (justifyContent === 'flex-end' && !field.config.unit) {
      // justify-content flex-end is not compatible with cellLink overflow; use direction instead
      cellProps.style.textAlign = 'right';
      cellProps.style.direction = 'rtl';
      cellProps.style.unicodeBidi = 'plaintext';
    } else {
      cellProps.style.justifyContent = justifyContent;
    }
  }

  let innerWidth = (typeof cell.column.width === 'number' ? cell.column.width : 24) - tableStyles.cellPadding * 2;

  const actions = getActions ? getActions(frame, field, cell.row.index, replaceVariables) : [];

  if (selectionEdges) {
    const borderColor = tableStyles.theme.colors.primary.main;
    const shadows: string[] = [];
    if (selectionEdges.top) {
      shadows.push(`inset 0 2px 0 0 ${borderColor}`);
    }
    if (selectionEdges.bottom) {
      shadows.push(`inset 0 -2px 0 0 ${borderColor}`);
    }
    if (selectionEdges.left) {
      shadows.push(`inset 2px 0 0 0 ${borderColor}`);
    }
    if (selectionEdges.right) {
      shadows.push(`inset -2px 0 0 0 ${borderColor}`);
    }
    if (shadows.length > 0) {
      cellProps.style = { ...cellProps.style, boxShadow: shadows.join(', ') };
    }
  }

  const enhancedCellProps = {
    ...cellProps,
    ...(onCellMouseDown && { onMouseDown: onCellMouseDown }),
    ...(onCellMouseEnter && { onMouseEnter: onCellMouseEnter }),
  };

  return (
    <>
      {cell.render('Cell', {
        field,
        tableStyles,
        onCellFilterAdded,
        cellProps: enhancedCellProps,
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
