import React, { FC, memo, useCallback, useMemo } from 'react';
import { DataFrame, Field, getFieldDisplayName } from '@grafana/data';
import {
  Cell,
  Column,
  HeaderGroup,
  useAbsoluteLayout,
  useFilters,
  UseFiltersState,
  useResizeColumns,
  UseResizeColumnsState,
  useSortBy,
  UseSortByState,
  useTable,
} from 'react-table';
import { FixedSizeList } from 'react-window';
import { getColumns, sortCaseInsensitive, sortNumber } from './utils';
import {
  TableColumnResizeActionCallback,
  TableFilterActionCallback,
  TableSortByActionCallback,
  TableSortByFieldState,
} from './types';
import { getTableStyles, TableStyles } from './styles';
import { Icon } from '../Icon/Icon';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { Filter } from './Filter';
import { TableCell } from './TableCell';
import { useStyles2 } from '../../themes';
import { selectors } from '@grafana/e2e-selectors';

const COLUMN_MIN_WIDTH = 150;
const e2eSelectorsTable = selectors.components.Panels.Visualization.Table;

export interface Props {
  ariaLabel?: string;
  data: DataFrame;
  width: number;
  height: number;
  /** Minimal column width specified in pixels */
  columnMinWidth?: number;
  noHeader?: boolean;
  resizable?: boolean;
  initialSortBy?: TableSortByFieldState[];
  onColumnResize?: TableColumnResizeActionCallback;
  onSortByChange?: TableSortByActionCallback;
  onCellFilterAdded?: TableFilterActionCallback;
}

interface ReactTableInternalState extends UseResizeColumnsState<{}>, UseSortByState<{}>, UseFiltersState<{}> {}

function useTableStateReducer({ onColumnResize, onSortByChange, data }: Props) {
  return useCallback(
    (newState: ReactTableInternalState, action: any) => {
      switch (action.type) {
        case 'columnDoneResizing':
          if (onColumnResize) {
            const info = (newState.columnResizing.headerIdWidths as any)[0];
            const columnIdString = info[0];
            const fieldIndex = parseInt(columnIdString, 10);
            const width = Math.round(newState.columnResizing.columnWidths[columnIdString] as number);

            const field = data.fields[fieldIndex];
            if (!field) {
              return newState;
            }

            const fieldDisplayName = getFieldDisplayName(field, data);
            onColumnResize(fieldDisplayName, width);
          }
        case 'toggleSortBy':
          if (onSortByChange) {
            const sortByFields: TableSortByFieldState[] = [];

            for (const sortItem of newState.sortBy) {
              const field = data.fields[parseInt(sortItem.id, 10)];
              if (!field) {
                continue;
              }

              sortByFields.push({
                displayName: getFieldDisplayName(field, data),
                desc: sortItem.desc,
              });
            }

            onSortByChange(sortByFields);
          }
          break;
      }

      return newState;
    },
    [data, onColumnResize, onSortByChange]
  );
}

function getInitialState(initialSortBy: Props['initialSortBy'], columns: Column[]): Partial<ReactTableInternalState> {
  const state: Partial<ReactTableInternalState> = {};

  if (initialSortBy) {
    state.sortBy = [];

    for (const sortBy of initialSortBy) {
      for (const col of columns) {
        if (col.Header === sortBy.displayName) {
          state.sortBy.push({ id: col.id as string, desc: sortBy.desc });
        }
      }
    }
  }

  return state;
}

export const Table: FC<Props> = memo((props: Props) => {
  const {
    ariaLabel,
    data,
    height,
    onCellFilterAdded,
    width,
    columnMinWidth = COLUMN_MIN_WIDTH,
    noHeader,
    resizable = true,
    initialSortBy,
  } = props;
  const tableStyles = useStyles2(getTableStyles);

  // React table data array. This data acts just like a dummy array to let react-table know how many rows exist
  // The cells use the field to look up values
  const memoizedData = useMemo(() => {
    if (!data.fields.length) {
      return [];
    }
    // as we only use this to fake the length of our data set for react-table we need to make sure we always return an array
    // filled with values at each index otherwise we'll end up trying to call accessRow for null|undefined value in
    // https://github.com/tannerlinsley/react-table/blob/7be2fc9d8b5e223fc998af88865ae86a88792fdb/src/hooks/useTable.js#L585
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
      initialState: getInitialState(initialSortBy, memoizedColumns),
      sortTypes: {
        number: sortNumber, // should be replace with the builtin number when react-table is upgraded, see https://github.com/tannerlinsley/react-table/pull/3235
        'alphanumeric-insensitive': sortCaseInsensitive, // should be replace with the builtin string when react-table is upgraded, see https://github.com/tannerlinsley/react-table/pull/3235
      },
    }),
    [initialSortBy, memoizedColumns, memoizedData, resizable, stateReducer]
  );

  const { getTableProps, headerGroups, rows, prepareRow, totalColumnsWidth } = useTable(
    options,
    useFilters,
    useSortBy,
    useAbsoluteLayout,
    useResizeColumns
  );

  const { fields } = data;

  const RenderRow = React.useCallback(
    ({ index: rowIndex, style }) => {
      const row = rows[rowIndex];
      prepareRow(row);
      return (
        <div {...row.getRowProps({ style })} className={tableStyles.row}>
          {row.cells.map((cell: Cell, index: number) => (
            <TableCell
              key={index}
              field={fields[index]}
              tableStyles={tableStyles}
              cell={cell}
              onCellFilterAdded={onCellFilterAdded}
              columnIndex={index}
              columnCount={row.cells.length}
            />
          ))}
        </div>
      );
    },
    [fields, onCellFilterAdded, prepareRow, rows, tableStyles]
  );

  const headerHeight = noHeader ? 0 : tableStyles.cellHeight;

  return (
    <div {...getTableProps()} className={tableStyles.table} aria-label={ariaLabel}>
      <CustomScrollbar hideVerticalTrack={true}>
        <div style={{ width: `${totalColumnsWidth}px` }}>
          {!noHeader && (
            <div>
              {headerGroups.map((headerGroup: HeaderGroup) => {
                const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();
                return (
                  <div
                    className={tableStyles.thead}
                    {...headerGroupProps}
                    key={key}
                    aria-label={e2eSelectorsTable.header}
                  >
                    {headerGroup.headers.map((column: Column, index: number) =>
                      renderHeaderCell(column, tableStyles, data.fields[index])
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {rows.length > 0 ? (
            <FixedSizeList
              height={height - headerHeight}
              itemCount={rows.length}
              itemSize={tableStyles.rowHeight}
              width={'100%'}
              style={{ overflow: 'hidden auto' }}
            >
              {RenderRow}
            </FixedSizeList>
          ) : (
            <div style={{ height: height - headerHeight }} className={tableStyles.noData}>
              No data
            </div>
          )}
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
  headerProps.style.justifyContent = (column as any).justifyContent;

  return (
    <div className={tableStyles.headerCell} {...headerProps}>
      {column.canSort && (
        <>
          <div
            {...column.getSortByToggleProps()}
            className={tableStyles.headerCellLabel}
            title={column.render('Header')}
          >
            <div>{column.render('Header')}</div>
            <div>
              {column.isSorted && (column.isSortedDesc ? <Icon name="arrow-down" /> : <Icon name="arrow-up" />)}
            </div>
          </div>
          {column.canFilter && <Filter column={column} tableStyles={tableStyles} field={field} />}
        </>
      )}
      {!column.canSort && column.render('Header')}
      {!column.canSort && column.canFilter && <Filter column={column} tableStyles={tableStyles} field={field} />}
      {column.canResize && <div {...column.getResizerProps()} className={tableStyles.resizeHandle} />}
    </div>
  );
}
