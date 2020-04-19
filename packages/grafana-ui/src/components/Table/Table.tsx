import React, { FC, memo, useMemo, useCallback } from 'react';
import { DataFrame, Field } from '@grafana/data';
import {
  Cell,
  Column,
  HeaderGroup,
  useAbsoluteLayout,
  useResizeColumns,
  useSortBy,
  useTable,
  UseResizeColumnsState,
  UseSortByState,
} from 'react-table';
import { FixedSizeList } from 'react-window';
import { getColumns, getTableRows, getTextAlign } from './utils';
import { useTheme } from '../../themes';
import { ColumnResizeActionCallback, TableFilterActionCallback } from './types';
import { getTableStyles, TableStyles } from './styles';
import { TableCell } from './TableCell';
import { Icon } from '../Icon/Icon';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';

const COLUMN_MIN_WIDTH = 150;

export interface Props {
  data: DataFrame;
  width: number;
  height: number;
  /** Minimal column width specified in pixels */
  columnMinWidth?: number;
  noHeader?: boolean;
  resizable?: boolean;
  onCellClick?: TableFilterActionCallback;
  onColumnResize?: ColumnResizeActionCallback;
}

interface ReactTableInternalState extends UseResizeColumnsState<{}>, UseSortByState<{}> {}

function useTableStateReducer(props: Props) {
  return useCallback(
    (newState: ReactTableInternalState, action: any) => {
      if (action.type === 'columnDoneResizing' && props.onColumnResize) {
        const info = (newState.columnResizing.headerIdWidths as any)[0];
        const name = info[0];
        const width = Math.round(newState.columnResizing.columnWidths[name] as number);
        props.onColumnResize(name, width);
      }
    },
    [props.onColumnResize]
  );
}

export const Table: FC<Props> = memo((props: Props) => {
  const { data, height, onCellClick, width, columnMinWidth = COLUMN_MIN_WIDTH, noHeader, resizable = true } = props;
  const theme = useTheme();
  const tableStyles = getTableStyles(theme);
  const memoizedColumns = useMemo(() => getColumns(data, width, columnMinWidth), [data, width, columnMinWidth]);
  const memoizedData = data.fields[0].values.toArray();
  const stateReducer = useTableStateReducer(props);

  const options: any = useMemo(
    () => ({
      columns: memoizedColumns,
      data: memoizedData,
      disableResizing: !resizable,
      stateReducer: stateReducer,
    }),
    [memoizedColumns, memoizedData, stateReducer, resizable]
  );

  const { getTableProps, headerGroups, rows, prepareRow, totalColumnsWidth } = useTable(
    options,
    useSortBy,
    useAbsoluteLayout,
    useResizeColumns
  );

  const RenderRow = React.useCallback(
    ({ index, style }) => {
      const row = rows[index];
      prepareRow(row);
      return (
        <div {...row.getRowProps({ style })} className={tableStyles.row}>
          {row.cells.map((cell: Cell, index: number) => (
            <TableCell
              key={index}
              field={data.fields[index]}
              tableStyles={tableStyles}
              cell={cell}
              onCellClick={onCellClick}
            />
          ))}
        </div>
      );
    },
    [prepareRow, rows]
  );

  const headerHeight = noHeader ? 0 : tableStyles.cellHeight;

  return (
    <div {...getTableProps()} className={tableStyles.table}>
      <CustomScrollbar hideVerticalTrack={true}>
        <div style={{ width: `${totalColumnsWidth}px` }}>
          {!noHeader && (
            <div>
              {headerGroups.map((headerGroup: HeaderGroup) => {
                return (
                  <div className={tableStyles.thead} {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map((column: Column, index: number) =>
                      renderHeaderCell(column, tableStyles, data.fields[index])
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <FixedSizeList
            height={height - headerHeight}
            itemCount={rows.length}
            itemSize={tableStyles.rowHeight}
            width={'100%'}
            style={{ overflow: 'hidden auto' }}
          >
            {RenderRow}
          </FixedSizeList>
        </div>
      </CustomScrollbar>
    </div>
  );
});

Table.displayName = 'Table';

function renderHeaderCell(column: any, tableStyles: TableStyles, field?: Field) {
  const headerProps = column.getHeaderProps();

  if (column.canResize) {
    headerProps.style.userSelect = column.isResizing ? 'none' : 'auto'; // disables selecting text while resizing
  }

  headerProps.style.position = 'absolute';
  headerProps.style.textAlign = getTextAlign(field);

  return (
    <div className={tableStyles.headerCell} {...headerProps}>
      {column.canSort && (
        <div {...column.getSortByToggleProps()}>
          {column.render('Header')}
          {column.isSorted && (column.isSortedDesc ? <Icon name="angle-down" /> : <Icon name="angle-up" />)}
        </div>
      )}
      {!column.canSort && <div>{column.render('Header')}</div>}
      {column.canResize && <div {...column.getResizerProps()} className={tableStyles.resizeHandle} />}
    </div>
  );
}
