import { type Cell } from 'react-table';

import { type DataFrame } from '@grafana/data/dataframe';
import type { TimeRange, InterpolateFunction } from '@grafana/data/types';

import { type TableStyles } from '../TableRT/styles';
import {
  type GetActionsFunction,
  type GrafanaTableColumn,
  type TableFilterActionCallback,
  type TableInspectCellCallback,
} from '../types';

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
