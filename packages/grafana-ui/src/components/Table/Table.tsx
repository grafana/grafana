import React, { CSSProperties, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cell,
  TableState,
  useAbsoluteLayout,
  useFilters,
  usePagination,
  useResizeColumns,
  useSortBy,
  useTable,
} from 'react-table';
import usePrevious from 'react-use/lib/usePrevious';
import { VariableSizeList } from 'react-window';

import { DataFrame, getFieldDisplayName, Field } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { Pagination } from '../Pagination/Pagination';

import { FooterRow } from './FooterRow';
import { HeaderRow } from './HeaderRow';
import { TableCell } from './TableCell';
import { getTableStyles } from './styles';
import {
  TableColumnResizeActionCallback,
  TableFilterActionCallback,
  FooterItem,
  TableSortByActionCallback,
  TableSortByFieldState,
  TableFooterCalc,
  GrafanaTableColumn,
} from './types';
import {
  getColumns,
  sortCaseInsensitive,
  sortNumber,
  getFooterItems,
  createFooterCalculationValues,
  EXPANDER_WIDTH,
} from './utils';

const COLUMN_MIN_WIDTH = 150;

export interface Props {
  ariaLabel?: string;
  data: DataFrame;
  width: number;
  height: number;
  /** Minimal column width specified in pixels */
  columnMinWidth?: number;
  noHeader?: boolean;
  showTypeIcons?: boolean;
  resizable?: boolean;
  initialSortBy?: TableSortByFieldState[];
  onColumnResize?: TableColumnResizeActionCallback;
  onSortByChange?: TableSortByActionCallback;
  onCellFilterAdded?: TableFilterActionCallback;
  footerOptions?: TableFooterCalc;
  footerValues?: FooterItem[];
  enablePagination?: boolean;
  /** @alpha */
  subData?: DataFrame[];
}

function useTableStateReducer({ onColumnResize, onSortByChange, data }: Props) {
  return useCallback(
    (newState: TableState, action: { type: string }) => {
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

function getInitialState(initialSortBy: Props['initialSortBy'], columns: GrafanaTableColumn[]): Partial<TableState> {
  const state: Partial<TableState> = {};

  if (initialSortBy) {
    state.sortBy = [];

    for (const sortBy of initialSortBy) {
      for (const col of columns) {
        if (col.Header === sortBy.displayName) {
          state.sortBy.push({ id: col.id!, desc: sortBy.desc });
        }
      }
    }
  }

  return state;
}

export const Table = memo((props: Props) => {
  const {
    ariaLabel,
    data,
    subData,
    height,
    onCellFilterAdded,
    width,
    columnMinWidth = COLUMN_MIN_WIDTH,
    noHeader,
    resizable = true,
    initialSortBy,
    footerOptions,
    showTypeIcons,
    footerValues,
    enablePagination,
  } = props;

  const listRef = useRef<VariableSizeList>(null);
  const tableDivRef = useRef<HTMLDivElement>(null);
  const variableSizeListScrollbarRef = useRef<HTMLDivElement>(null);
  const tableStyles = useStyles2(getTableStyles);
  const theme = useTheme2();
  const headerHeight = noHeader ? 0 : tableStyles.cellHeight;
  const [footerItems, setFooterItems] = useState<FooterItem[] | undefined>(footerValues);
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(new Set());
  const prevExpandedIndexes = usePrevious(expandedIndexes);

  const footerHeight = useMemo(() => {
    const EXTENDED_ROW_HEIGHT = 33;
    let length = 0;

    if (!footerItems) {
      return 0;
    }

    for (const fv of footerItems) {
      if (Array.isArray(fv) && fv.length > length) {
        length = fv.length;
      }
    }

    if (length > 1) {
      return EXTENDED_ROW_HEIGHT * length;
    }

    return EXTENDED_ROW_HEIGHT;
  }, [footerItems]);

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
  const memoizedColumns = useMemo(
    () => getColumns(data, width, columnMinWidth, expandedIndexes, setExpandedIndexes, !!subData?.length, footerItems),
    [data, width, columnMinWidth, footerItems, subData, expandedIndexes]
  );

  // Internal react table state reducer
  const stateReducer = useTableStateReducer(props);

  const options: any = useMemo(
    () => ({
      columns: memoizedColumns,
      data: memoizedData,
      disableResizing: !resizable,
      stateReducer: stateReducer,
      initialState: getInitialState(initialSortBy, memoizedColumns),
      autoResetFilters: false,
      sortTypes: {
        number: sortNumber, // the builtin number type on react-table does not handle NaN values
        'alphanumeric-insensitive': sortCaseInsensitive, // should be replace with the builtin string when react-table is upgraded, see https://github.com/tannerlinsley/react-table/pull/3235
      },
    }),
    [initialSortBy, memoizedColumns, memoizedData, resizable, stateReducer]
  );

  const {
    getTableProps,
    headerGroups,
    rows,
    prepareRow,
    totalColumnsWidth,
    footerGroups,
    page,
    state,
    gotoPage,
    setPageSize,
    pageOptions,
  } = useTable(options, useFilters, useSortBy, usePagination, useAbsoluteLayout, useResizeColumns);

  /*
    Footer value calculation is being moved in the Table component and the footerValues prop will be deprecated.
    The footerValues prop is still used in the Table component for backwards compatibility. Adding the
    footerOptions prop will switch the Table component to use the new footer calculation. Using both props will
    result in the footerValues prop being ignored.
  */
  useEffect(() => {
    if (!footerOptions) {
      setFooterItems(footerValues);
    }
  }, [footerValues, footerOptions]);

  useEffect(() => {
    if (!footerOptions) {
      return;
    }

    if (footerOptions.show) {
      setFooterItems(
        getFooterItems(
          headerGroups[0].headers as unknown as Array<{ field: Field }>,
          createFooterCalculationValues(rows),
          footerOptions,
          theme
        )
      );
    } else {
      setFooterItems(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [footerOptions, theme, state.filters, data]);

  let listHeight = height - (headerHeight + footerHeight);

  if (enablePagination) {
    listHeight -= tableStyles.cellHeight;
  }
  const pageSize = Math.round(listHeight / tableStyles.cellHeight) - 1;
  useEffect(() => {
    // Don't update the page size if it is less than 1
    if (pageSize <= 0) {
      return;
    }
    setPageSize(pageSize);
  }, [pageSize, setPageSize]);

  useEffect(() => {
    // react-table caches the height of cells so we need to reset them when expanding/collapsing rows
    // We need to take the minimum of the current expanded indexes and the previous expandedIndexes array to account
    // for collapsed rows, since they disappear from expandedIndexes but still keep their expanded height
    listRef.current?.resetAfterIndex(
      Math.min(...Array.from(expandedIndexes), ...(prevExpandedIndexes ? Array.from(prevExpandedIndexes) : []))
    );
  }, [expandedIndexes, prevExpandedIndexes]);

  useEffect(() => {
    // To have the custom vertical scrollbar always visible (https://github.com/grafana/grafana/issues/52136),
    // we need to bring the element from the VariableSizeList scope to the outer Table container scope,
    // because the VariableSizeList scope has overflow. By moving scrollbar to container scope we will have
    // it always visible since the entire width is in view.

    // Select the scrollbar element from the VariableSizeList scope
    const listVerticalScrollbarHTML = (variableSizeListScrollbarRef.current as HTMLDivElement)?.querySelector(
      '.track-vertical'
    );

    // Select Table custom scrollbars
    const tableScrollbarView = (tableDivRef.current as HTMLDivElement)?.firstChild;

    //If they exists, move the scrollbar element to the Table container scope
    if (tableScrollbarView && listVerticalScrollbarHTML) {
      listVerticalScrollbarHTML?.remove();
      (tableScrollbarView as HTMLDivElement).querySelector(':scope > .track-vertical')?.remove();

      (tableScrollbarView as HTMLDivElement).append(listVerticalScrollbarHTML as Node);
    }
  });

  useEffect(() => {
    setExpandedIndexes(new Set());
  }, [data, subData]);

  const renderSubTable = React.useCallback(
    (rowIndex: number) => {
      if (expandedIndexes.has(rowIndex)) {
        const rowSubData = subData?.find((frame) => frame.meta?.custom?.parentRowIndex === rowIndex);
        if (rowSubData) {
          const noHeader = !!rowSubData.meta?.custom?.noHeader;
          const subTableStyle: CSSProperties = {
            height: tableStyles.rowHeight * (rowSubData.length + (noHeader ? 0 : 1)), // account for the header with + 1
            background: theme.colors.emphasize(theme.colors.background.primary, 0.015),
            paddingLeft: EXPANDER_WIDTH,
            position: 'absolute',
            bottom: 0,
          };
          return (
            <div style={subTableStyle}>
              <Table
                data={rowSubData}
                width={width - EXPANDER_WIDTH}
                height={tableStyles.rowHeight * (rowSubData.length + 1)}
                noHeader={noHeader}
              />
            </div>
          );
        }
      }
      return null;
    },
    [expandedIndexes, subData, tableStyles.rowHeight, theme.colors, width]
  );

  const RenderRow = React.useCallback(
    ({ index: rowIndex, style }: { index: number; style: CSSProperties }) => {
      let row = rows[rowIndex];
      if (enablePagination) {
        row = page[rowIndex];
      }
      prepareRow(row);

      return (
        <div {...row.getRowProps({ style })} className={tableStyles.row}>
          {/*add the subtable to the DOM first to prevent a 1px border CSS issue on the last cell of the row*/}
          {renderSubTable(rowIndex)}
          {row.cells.map((cell: Cell, index: number) => (
            <TableCell
              key={index}
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
    [onCellFilterAdded, page, enablePagination, prepareRow, rows, tableStyles, renderSubTable]
  );

  const onNavigate = useCallback(
    (toPage: number) => {
      gotoPage(toPage - 1);
    },
    [gotoPage]
  );

  const itemCount = enablePagination ? page.length : rows.length;
  let paginationEl = null;
  if (enablePagination) {
    const itemsRangeStart = state.pageIndex * state.pageSize + 1;
    let itemsRangeEnd = itemsRangeStart + state.pageSize - 1;
    const isSmall = width < 550;
    if (itemsRangeEnd > data.length) {
      itemsRangeEnd = data.length;
    }
    paginationEl = (
      <div className={tableStyles.paginationWrapper}>
        {isSmall ? null : <div className={tableStyles.paginationItem} />}
        <div className={tableStyles.paginationCenterItem}>
          <Pagination
            currentPage={state.pageIndex + 1}
            numberOfPages={pageOptions.length}
            showSmallVersion={isSmall}
            onNavigate={onNavigate}
          />
        </div>
        {isSmall ? null : (
          <div className={tableStyles.paginationSummary}>
            {itemsRangeStart} - {itemsRangeEnd} of {data.length} rows
          </div>
        )}
      </div>
    );
  }

  const getItemSize = (index: number): number => {
    if (expandedIndexes.has(index)) {
      const rowSubData = subData?.find((frame) => frame.meta?.custom?.parentRowIndex === index);
      if (rowSubData) {
        const noHeader = !!rowSubData.meta?.custom?.noHeader;
        return tableStyles.rowHeight * (rowSubData.length + 1 + (noHeader ? 0 : 1)); // account for the header and the row data with + 1 + 1
      }
    }
    return tableStyles.rowHeight;
  };

  const handleScroll: React.UIEventHandler = (event) => {
    const { scrollTop } = event.target as HTMLDivElement;

    if (listRef.current !== null) {
      listRef.current.scrollTo(scrollTop);
    }
  };

  return (
    <div {...getTableProps()} className={tableStyles.table} aria-label={ariaLabel} role="table" ref={tableDivRef}>
      <CustomScrollbar hideVerticalTrack={true}>
        <div className={tableStyles.tableContentWrapper(totalColumnsWidth)}>
          {!noHeader && <HeaderRow headerGroups={headerGroups} showTypeIcons={showTypeIcons} />}
          {itemCount > 0 ? (
            <div ref={variableSizeListScrollbarRef}>
              <CustomScrollbar onScroll={handleScroll} hideHorizontalTrack={true}>
                <VariableSizeList
                  height={listHeight}
                  itemCount={itemCount}
                  itemSize={getItemSize}
                  width={'100%'}
                  ref={listRef}
                  style={{ overflow: undefined }}
                >
                  {RenderRow}
                </VariableSizeList>
              </CustomScrollbar>
            </div>
          ) : (
            <div style={{ height: height - headerHeight }} className={tableStyles.noData}>
              No data
            </div>
          )}
          {footerItems && (
            <FooterRow
              height={footerHeight}
              isPaginationVisible={Boolean(enablePagination)}
              footerValues={footerItems}
              footerGroups={footerGroups}
              totalColumnsWidth={totalColumnsWidth}
            />
          )}
        </div>
      </CustomScrollbar>
      {paginationEl}
    </div>
  );
});

Table.displayName = 'Table';
