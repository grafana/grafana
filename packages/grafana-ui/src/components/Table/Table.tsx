import React, { CSSProperties, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cell,
  useAbsoluteLayout,
  useExpanded,
  useFilters,
  usePagination,
  useResizeColumns,
  useSortBy,
  useTable,
} from 'react-table';
import { VariableSizeList } from 'react-window';

import { Field, ReducerID } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { Pagination } from '../Pagination/Pagination';

import { FooterRow } from './FooterRow';
import { HeaderRow } from './HeaderRow';
import { TableCell } from './TableCell';
import { useFixScrollbarContainer, useResetVariableListSizeCacheWhenExpendedRowsChange } from './hooks';
import { getInitialState, useTableStateReducer } from './reducer';
import { getTableStyles } from './styles';
import { FooterItem, GrafanaTableState, Props } from './types';
import {
  getColumns,
  sortCaseInsensitive,
  sortNumber,
  getFooterItems,
  createFooterCalculationValues,
  EXPANDER_WIDTH,
} from './utils';

const COLUMN_MIN_WIDTH = 150;

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
  const headerHeight = noHeader ? 0 : tableStyles.rowHeight;
  const [footerItems, setFooterItems] = useState<FooterItem[] | undefined>(footerValues);

  const footerHeight = useMemo(() => {
    const EXTENDED_ROW_HEIGHT = headerHeight;
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
  }, [footerItems, headerHeight]);

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

  const isCountRowsSet = Boolean(
    footerOptions?.countRows &&
      footerOptions.reducer &&
      footerOptions.reducer.length &&
      footerOptions.reducer[0] === ReducerID.count
  );

  // React-table column definitions
  const memoizedColumns = useMemo(
    () => getColumns(data, width, columnMinWidth, !!subData?.length, footerItems, isCountRowsSet),
    [data, width, columnMinWidth, footerItems, subData, isCountRowsSet]
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
  } = useTable(options, useFilters, useSortBy, useAbsoluteLayout, useResizeColumns, useExpanded, usePagination);

  const extendedState = state as GrafanaTableState;

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

    if (!footerOptions.show) {
      setFooterItems(undefined);
      return;
    }

    const footerItems = getFooterItems(
      headerGroups[0].headers as unknown as Array<{ field: Field }>,
      createFooterCalculationValues(rows),
      footerOptions,
      theme
    );

    if (isCountRowsSet) {
      const footerItemsCountRows: FooterItem[] = new Array(footerItems.length).fill(undefined);
      footerItemsCountRows[0] = data.length.toString();
      setFooterItems(footerItemsCountRows);
    } else {
      setFooterItems(footerItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [footerOptions, theme, state.filters, data]);

  let listHeight = height - (headerHeight + footerHeight);

  if (enablePagination) {
    listHeight -= tableStyles.cellHeight;
  }

  const pageSize = Math.round(listHeight / tableStyles.rowHeight) - 1;

  useEffect(() => {
    // Don't update the page size if it is less than 1
    if (pageSize <= 0) {
      return;
    }
    setPageSize(pageSize);
  }, [pageSize, setPageSize]);

  useResetVariableListSizeCacheWhenExpendedRowsChange(extendedState, listRef);
  useFixScrollbarContainer(variableSizeListScrollbarRef, tableDivRef);

  const renderSubTable = React.useCallback(
    (rowIndex: number) => {
      if (state.expanded[rowIndex]) {
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
    [state.expanded, subData, tableStyles.rowHeight, theme.colors, width]
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
    if (state.expanded[index]) {
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
          {!noHeader && (
            <HeaderRow headerGroups={headerGroups} showTypeIcons={showTypeIcons} tableStyles={tableStyles} />
          )}
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
              isPaginationVisible={Boolean(enablePagination)}
              footerValues={footerItems}
              footerGroups={footerGroups}
              totalColumnsWidth={totalColumnsWidth}
              tableStyles={tableStyles}
            />
          )}
        </div>
      </CustomScrollbar>
      {paginationEl}
    </div>
  );
});

Table.displayName = 'Table';
