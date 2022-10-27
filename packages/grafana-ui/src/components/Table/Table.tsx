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
import { FixedSizeList } from 'react-window';

import {
  DataFrame,
  getFieldDisplayName,
  Field,
  MutableDataFrame,
  ArrayVector,
  ValueLinkConfig,
  LinkModel,
} from '@grafana/data';

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
import { getColumns, sortCaseInsensitive, sortNumber, getFooterItems, createFooterCalculationValues } from './utils';

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
  getLinks?: (field: Field, data: DataFrame) => (config: ValueLinkConfig) => Array<LinkModel<Field>>;
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
    getLinks,
  } = props;

  const listRef = useRef<FixedSizeList>(null);
  const tableDivRef = useRef<HTMLDivElement>(null);
  const fixedSizeListScrollbarRef = useRef<HTMLDivElement>(null);
  const tableStyles = useStyles2(getTableStyles);
  const theme = useTheme2();
  const headerHeight = noHeader ? 0 : tableStyles.cellHeight;
  const [footerItems, setFooterItems] = useState<FooterItem[] | undefined>(footerValues);
  const [expandedIndex, setExpandedIndex] = useState<number>();

  const { mainData, subData, indexesToKeepBlank, expandable } = useMainData(data, expandedIndex);

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
    if (!mainData.fields.length) {
      return [];
    }
    // as we only use this to fake the length of our data set for react-table we need to make sure we always return an array
    // filled with values at each index otherwise we'll end up trying to call accessRow for null|undefined value in
    // https://github.com/tannerlinsley/react-table/blob/7be2fc9d8b5e223fc998af88865ae86a88792fdb/src/hooks/useTable.js#L585
    return Array(mainData.length).fill(0);
  }, [mainData]);

  // React-table column definitions
  const memoizedColumns = useMemo(
    () =>
      getColumns(
        mainData,
        width,
        columnMinWidth,
        expandedIndex,
        setExpandedIndex,
        expandable,
        indexesToKeepBlank,
        footerItems
      ),
    [mainData, width, columnMinWidth, footerItems, expandedIndex, expandable, indexesToKeepBlank]
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
  } = useTable(options, useFilters, useSortBy, useAbsoluteLayout, useResizeColumns, usePagination);

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
    // To have the custom vertical scrollbar always visible (https://github.com/grafana/grafana/issues/52136),
    // we need to bring the element from the FixedSizeList scope to the outer Table container scope,
    // because the FixedSizeList scope has overflow. By moving scrollbar to container scope we will have
    // it always visible since the entire width is in view.

    // Select the scrollbar element from the FixedSizeList scope
    const listVerticalScrollbarHTML = (fixedSizeListScrollbarRef.current as HTMLDivElement)?.querySelector(
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

  const RenderRow = React.useCallback(
    ({ index: rowIndex, style }: { index: number; style: CSSProperties }) => {
      let row = rows[rowIndex];
      if (enablePagination) {
        row = page[rowIndex];
      }
      prepareRow(row);

      if (expandedIndex !== undefined && expandedIndex + 1 === rowIndex) {
        const rowProps = row.getRowProps({ style });
        rowProps.style = {
          ...rowProps.style,
          height: tableStyles.rowHeight * indexesToKeepBlank.length,
          background: theme.colors.emphasize(theme.colors.background.primary, 0.015),
          paddingLeft: 50,
        };
        return (
          <div {...rowProps}>
            <Table
              data={subData!}
              width={width - 80}
              height={tableStyles.rowHeight * indexesToKeepBlank.length}
              getLinks={getLinks}
            />
          </div>
        );
      }

      if (indexesToKeepBlank.includes(rowIndex)) {
        return null;
      }

      return (
        <div {...row.getRowProps({ style })} className={tableStyles.row}>
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
    [
      onCellFilterAdded,
      page,
      enablePagination,
      prepareRow,
      rows,
      tableStyles,
      expandedIndex,
      indexesToKeepBlank,
      width,
      subData,
      theme,
      getLinks,
    ]
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

  const handleScroll: React.UIEventHandler = (event) => {
    const { scrollTop } = event.target as HTMLDivElement;

    if (listRef.current !== null) {
      listRef.current.scrollTo(scrollTop);
    }
  };

  // Interpolate and add links to cells
  for (const field of mainData.fields) {
    field.getLinks = getLinks?.(field, mainData);
  }

  return (
    <div {...getTableProps()} className={tableStyles.table} aria-label={ariaLabel} role="table" ref={tableDivRef}>
      <CustomScrollbar hideVerticalTrack={true}>
        <div className={tableStyles.tableContentWrapper(totalColumnsWidth)}>
          {!noHeader && <HeaderRow headerGroups={headerGroups} showTypeIcons={showTypeIcons} />}
          {itemCount > 0 ? (
            <div ref={fixedSizeListScrollbarRef}>
              <CustomScrollbar onScroll={handleScroll} hideHorizontalTrack={true}>
                <FixedSizeList
                  height={listHeight}
                  itemCount={itemCount}
                  itemSize={tableStyles.rowHeight}
                  width={'100%'}
                  ref={listRef}
                  style={{ overflow: undefined }}
                >
                  {RenderRow}
                </FixedSizeList>
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

function useMainData(
  data: DataFrame,
  // This is index after filtering so we cannot use it directly with data
  expandedIndex: number | undefined
): { mainData: DataFrame; subData?: DataFrame; indexesToKeepBlank: number[]; expandable: boolean } {
  return useMemo(() => {
    const subCols: Field[] = [];
    const mainCols: Field[] = [];
    let indexesToKeepBlank: number[] = [];

    for (const f of data.fields) {
      if (f.config.custom?.subcol) {
        subCols.push(f);
      } else {
        mainCols.push(f);
      }
    }

    if (!subCols.length) {
      return {
        mainData: data,
        subData: undefined,
        indexesToKeepBlank,
        expandable: false,
      };
    }

    // We need to filter out rows and there does not seem to be an easy util for that. This is a bit convoluted though.
    // Probably try using DataFrameView and MutableDataFrame to loop over rows instead of this manual indexing.

    let inSubColumns = false;
    const newMainValues = mainCols.map(() => new ArrayVector());
    const newSubValues = subCols.map(() => new ArrayVector());

    for (let rowIndex = 0; rowIndex < mainCols[0].values.length; rowIndex++) {
      const isMainRow = mainCols.some((col) => col.values.get(rowIndex));
      if (isMainRow) {
        for (let columnIndex = 0; columnIndex < mainCols.length; columnIndex++) {
          newMainValues[columnIndex].add(mainCols[columnIndex].values.get(rowIndex));
        }

        inSubColumns = false;
        continue;
      }

      const isFirstExpandedSubRow =
        !isMainRow && expandedIndex !== undefined && newMainValues[0].length - 1 === expandedIndex;
      if (isFirstExpandedSubRow || inSubColumns) {
        indexesToKeepBlank.push(newMainValues[0].length);

        if (isFirstExpandedSubRow) {
          // We add an empty row to account for subtable header
          for (let columnIndex = 0; columnIndex < mainCols.length; columnIndex++) {
            newMainValues[columnIndex].add(null);
          }
          indexesToKeepBlank.push(newMainValues[0].length);
        }

        for (let columnIndex = 0; columnIndex < mainCols.length; columnIndex++) {
          newMainValues[columnIndex].add(null);
        }

        for (let columnIndex = 0; columnIndex < subCols.length; columnIndex++) {
          newSubValues[columnIndex].add(subCols[columnIndex].values.get(rowIndex));
        }

        inSubColumns = true;
      }
    }

    const newMainFields = mainCols.map((col, index) => {
      return {
        ...col,
        values: newMainValues[index],
      };
    });

    const newSubFields = subCols.map<Field>((col, index) => {
      return {
        ...col,
        config: {
          ...col.config,
          custom: {
            ...(col.config.custom || {}),
            subcol: false,
          },
        },
        values: newSubValues[index],
      };
    });

    return {
      mainData: new MutableDataFrame({
        ...data,
        fields: newMainFields,
      }),
      subData: new MutableDataFrame({
        ...data,
        fields: newSubFields,
      }),
      indexesToKeepBlank,
      expandable: true,
    };
  }, [data, expandedIndex]);
}

Table.displayName = 'Table';
