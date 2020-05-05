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
import { getColumns, getTextAlign, isNullOrUndefined } from './utils';
import { useTheme } from '../../themes';
import { TableColumnResizeActionCallback, TableFilterActionCallback, TableSortByActionCallback } from './types';
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
  onColumnResize?: TableColumnResizeActionCallback;
  onSortBy?: TableSortByActionCallback;
}

interface ReactTableInternalState extends UseResizeColumnsState<{}>, UseSortByState<{}> {}

function useTableStateReducer(props: Props) {
  return useCallback(
    (newState: ReactTableInternalState, action: any) => {
      switch (action.type) {
        case 'columnDoneResizing':
          if (props.onColumnResize) {
            const info = (newState.columnResizing.headerIdWidths as any)[0];
            const columnIdString = info[0];
            const fieldIndex = parseInt(columnIdString, 10);
            const width = Math.round(newState.columnResizing.columnWidths[columnIdString] as number);
            props.onColumnResize(fieldIndex, width);
          }
        case 'toggleSortBy':
          if (props.onSortBy) {
            // todo call callback and persist
          }
          break;
      }

      return newState;
    },
    [props.onColumnResize]
  );
}

export const Table: FC<Props> = memo((props: Props) => {
  const { data, height, onCellClick, width, columnMinWidth = COLUMN_MIN_WIDTH, noHeader, resizable = true } = props;
  const theme = useTheme();
  const tableStyles = getTableStyles(theme);

  // React table data array. This data acts just like a dummy array to let react-table know how many rows exist
  // The cells use the field to look up values
  const memoizedData = useMemo(() => {
    if (!data.fields.length) {
      return [];
    }

    // Check if an array buffer already exists
    const buffer = (data.fields[0].values as any).buffer;

    // Check if buffer is array and filter out all null and undefined values as they would throw an error
    const filteredBuffer = Array.isArray(buffer) && buffer.filter(value => !isNullOrUndefined(value));

    if (filteredBuffer && filteredBuffer.length === data.length) {
      return filteredBuffer;
    }

    // For arrow tables, the `toArray` implementation is expensive and akward *especially* for timestamps
    return Array(data.length).fill(0);
  }, [data]);

  // React-table column definitions
  const memoizedColumns = useMemo(() => getColumns(data, width, columnMinWidth), [data, width, columnMinWidth]);

  // Internal react table state reducer
  const stateReducer = useTableStateReducer(props);

  const options: any = useMemo(
    () => ({
      columns: memoizedColumns,
      data: memoizedData,
      disableResizing: !resizable,
      stateReducer: stateReducer,
      // this is how you set initial sort by state
      // initialState: {
      //   sortBy: [{ id: '2', desc: true }],
      // },
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
        <div {...column.getSortByToggleProps()} className={tableStyles.headerCellLabel} title={column.render('Header')}>
          {column.render('Header')}
          {column.isSorted && (column.isSortedDesc ? <Icon name="angle-down" /> : <Icon name="angle-up" />)}
        </div>
      )}
      {!column.canSort && <div>{column.render('Header')}</div>}
      {column.canResize && <div {...column.getResizerProps()} className={tableStyles.resizeHandle} />}
    </div>
  );
}
