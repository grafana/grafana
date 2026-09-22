import {
  functionalUpdate,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnSizingInfoState,
  type ColumnSizingState,
  type ExpandedState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type VariableSizeList } from 'react-window';

import { FieldType, ReducerID, getRowUniqueId, getFieldMatcher, getFieldDisplayName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { TableCellHeight } from '@grafana/schema';

import { useTheme2 } from '../../../themes/ThemeContext';
import { CustomScrollbar } from '../../CustomScrollbar/CustomScrollbar';
import { Pagination } from '../../Pagination/Pagination';
import { TableCellInspector } from '../TableCellInspector';
import { hasGeoCell, LazyOpenLayersProvider } from '../geo';
import { useFixScrollbarContainer, useResetVariableListSizeCache } from '../hooks';
import { getInitialState } from '../reducer';
import { type FooterItem, type GrafanaTableState, type InspectCell, type TableRTProps as Props } from '../types';
import { getColumns, getFooterItems, createFooterCalculationValues, guessLongestField } from '../utils';

import { FooterRow } from './FooterRow';
import { HeaderRow } from './HeaderRow';
import { RowsList } from './RowsList';
import { useTableStyles } from './styles';

const COLUMN_MIN_WIDTH = 150;
const FOOTER_ROW_HEIGHT = 36;
const NO_DATA_TEXT = 'No data';

/**
 * Used for displaying tabular data
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/plugins-table--docs
 */
export const Table = memo((props: Props) => {
  const {
    ariaLabel,
    data,
    height,
    onCellFilterAdded,
    onColumnResize,
    width,
    columnMinWidth = COLUMN_MIN_WIDTH,
    noHeader,
    resizable = true,
    initialSortBy,
    footerOptions,
    showTypeIcons,
    footerValues,
    enablePagination,
    cellHeight = TableCellHeight.Sm,
    timeRange,
    enableSharedCrosshair = false,
    initialRowIndex = undefined,
    fieldConfig,
    getActions,
    replaceVariables,
  } = props;

  const listRef = useRef<VariableSizeList>(null);
  const tableDivRef = useRef<HTMLDivElement>(null);
  const variableSizeListScrollbarRef = useRef<HTMLDivElement>(null);
  const theme = useTheme2();
  const tableStyles = useTableStyles(theme, cellHeight);
  const headerHeight = noHeader ? 0 : tableStyles.rowHeight;
  const [footerItems, setFooterItems] = useState<FooterItem[] | undefined>(footerValues);
  const noValuesDisplayText = fieldConfig?.defaults?.noValue ?? NO_DATA_TEXT;
  const [inspectCell, setInspectCell] = useState<InspectCell | null>(null);

  const footerHeight = useMemo(() => {
    const EXTENDED_ROW_HEIGHT = FOOTER_ROW_HEIGHT;
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

  // React table data array. This data acts just like a dummy array to let react-table know how many rows exist.
  // The cells use the field to look up values, therefore this is simply a length/size placeholder.
  const memoizedData = useMemo(() => {
    if (!data.fields.length) {
      return [];
    }
    // As we only use this to fake the length of our data set for react-table we need to make sure we always return an array
    // filled with values at each index otherwise we'll end up trying to call accessRow for null|undefined value in
    // https://github.com/tannerlinsley/react-table/blob/7be2fc9d8b5e223fc998af88865ae86a88792fdb/src/hooks/useTable.js#L585
    return Array(data.length).fill(0);
  }, [data]);

  // This checks whether `Show table footer` is toggled on, the `Calculation` is set to `Count`, and finally, whether `Count rows` is toggled on.
  const isCountRowsSet = Boolean(
    footerOptions?.countRows &&
      footerOptions.reducer &&
      footerOptions.reducer.length &&
      footerOptions.reducer[0] === ReducerID.count
  );

  const nestedDataField = data.fields.find((f) => f.type === FieldType.nestedFrames);
  const hasNestedData = nestedDataField !== undefined;

  // React-table column definitions
  const memoizedColumns = useMemo(
    () => getColumns(data, width, columnMinWidth, hasNestedData, footerItems, isCountRowsSet),
    [data, width, columnMinWidth, hasNestedData, footerItems, isCountRowsSet]
  );

  const hasUniqueId = !!data.meta?.uniqueRowIdFields?.length;
  const tableHasGeoCell = useMemo(() => hasGeoCell(data), [data]);
  const initialState = useMemo(() => getInitialState(initialSortBy, memoizedColumns), [initialSortBy, memoizedColumns]);
  const [sorting, setSorting] = useState<SortingState>(initialState.sorting ?? []);
  const previousSorting = useRef(sorting);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [lastExpandedOrCollapsedIndex, setLastExpandedOrCollapsedIndex] = useState<number>();
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnSizingInfo, setColumnSizingInfo] = useState<ColumnSizingInfoState>({
    startOffset: null,
    startSize: null,
    deltaOffset: null,
    deltaPercentage: null,
    isResizingColumn: false,
    columnSizingStart: [],
  });
  const resizingColumnRef = useRef<string | false>(false);

  const tableInstance = useReactTable<unknown>({
    columns: memoizedColumns,
    data: memoizedData,
    state: { sorting, expanded, columnSizing, columnSizingInfo },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowCanExpand: () => hasNestedData,
    enableColumnResizing: resizable,
    columnResizeMode: 'onChange',
    // TanStack Table sorts number columns descending first, react-table always started ascending
    sortDescFirst: false,
    autoResetPageIndex: false,
    autoResetExpanded: !hasUniqueId,
    getRowId: hasUniqueId
      ? (_row, relativeIndex) => getRowUniqueId(data, relativeIndex) ?? String(relativeIndex)
      : undefined,
    onSortingChange: (updater) => setSorting((current) => functionalUpdate(updater, current)),
    onExpandedChange: (updater) => {
      setExpanded((current) => {
        const next = functionalUpdate(updater, current);
        if (next !== true) {
          const currentState = current === true ? {} : current;
          const changedId = Array.from(new Set([...Object.keys(currentState), ...Object.keys(next)])).find(
            (id) => Boolean(currentState[id]) !== Boolean(next[id])
          );
          if (changedId) {
            setLastExpandedOrCollapsedIndex(parseInt(changedId, 10));
          }
        }
        return next;
      });
    },
    onColumnSizingChange: setColumnSizing,
    onColumnSizingInfoChange: setColumnSizingInfo,
  });

  const headerGroups = tableInstance.getHeaderGroups();
  const footerGroups = tableInstance.getFooterGroups();
  const rows = tableInstance.getPrePaginationRowModel().rows;
  const page = tableInstance.getRowModel().rows;
  const state = tableInstance.getState();
  const totalColumnsWidth = tableInstance.getTotalSize();
  const extendedState: GrafanaTableState = { ...state, lastExpandedOrCollapsedIndex };

  useEffect(() => {
    if (previousSorting.current === sorting) {
      return;
    }

    previousSorting.current = sorting;
    setExpanded({});
    props.onSortByChange?.(
      sorting.flatMap((sortItem) => {
        const field = data.fields[parseInt(sortItem.id, 10)];
        return field ? [{ displayName: getFieldDisplayName(field, data), desc: sortItem.desc }] : [];
      })
    );
  }, [data, props, sorting]);

  useEffect(() => {
    const previousColumn = resizingColumnRef.current;
    resizingColumnRef.current = columnSizingInfo.isResizingColumn;
    if (!previousColumn || columnSizingInfo.isResizingColumn || !onColumnResize) {
      return;
    }
    const field = data.fields[parseInt(previousColumn, 10)];
    if (field) {
      onColumnResize(getFieldDisplayName(field, data), Math.round(columnSizing[previousColumn] ?? 0));
    }
  }, [columnSizing, columnSizingInfo.isResizingColumn, data, onColumnResize]);

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

    if (isCountRowsSet) {
      const footerItemsCountRows: FooterItem[] = [];
      footerItemsCountRows[0] = rows.length.toString() ?? data.length.toString();
      setFooterItems(footerItemsCountRows);
      return;
    }

    const footerItems = getFooterItems(
      headerGroups[0].headers.map((header) => ({ id: header.column.id, field: header.column.columnDef.meta?.field })),
      createFooterCalculationValues(rows),
      footerOptions,
      theme
    );

    setFooterItems(footerItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [footerOptions, theme, state.columnFilters, data]);

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
    tableInstance.setPageSize(pageSize);
  }, [pageSize, tableInstance]);

  useEffect(() => {
    // Reset page index when data changes
    // This is needed because react-table does not do this automatically
    // autoResetPage is set to false because setting it to true causes the issue described in
    // https://github.com/grafana/grafana/pull/67477
    if (data.length / pageSize < state.pagination.pageIndex) {
      tableInstance.setPageIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useResetVariableListSizeCache(extendedState, listRef, data, hasUniqueId);
  useFixScrollbarContainer(variableSizeListScrollbarRef, tableDivRef);

  const onNavigate = useCallback(
    (toPage: number) => {
      tableInstance.setPageIndex(toPage - 1);
    },
    [tableInstance]
  );

  const itemCount = enablePagination ? page.length : rows.length;

  // Virtualization means only the visible rows exist in the DOM, so we announce the real
  // row count to screen readers. ARIA row counts are 1-based and include the header row.
  const ariaRowCount = (noHeader ? 0 : 1) + rows.length;
  let paginationEl = null;
  if (enablePagination) {
    const itemsRangeStart = state.pagination.pageIndex * state.pagination.pageSize + 1;
    let itemsRangeEnd = itemsRangeStart + state.pagination.pageSize - 1;
    const isSmall = width < 550;
    if (itemsRangeEnd > data.length) {
      itemsRangeEnd = data.length;
    }
    const numRows = rows.length;
    const displayedEnd = itemsRangeEnd < rows.length ? itemsRangeEnd : rows.length;
    paginationEl = (
      <div className={tableStyles.paginationWrapper}>
        <Pagination
          currentPage={state.pagination.pageIndex + 1}
          numberOfPages={tableInstance.getPageCount()}
          showSmallVersion={isSmall}
          onNavigate={onNavigate}
        />
        {isSmall ? null : (
          <div className={tableStyles.paginationSummary}>
            <Trans i18nKey="grafana-ui.table.pagination-summary">
              {{ itemsRangeStart }} - {{ displayedEnd }} of {{ numRows }} rows
            </Trans>
          </div>
        )}
      </div>
    );
  }

  // Try to determine the longest field
  // TODO: do we wrap only one field?
  // What if there are multiple fields with long text?
  const longestField = fieldConfig ? guessLongestField(fieldConfig, data) : undefined;
  let textWrapField = undefined;
  if (fieldConfig !== undefined) {
    data.fields.forEach((field) => {
      fieldConfig.overrides.forEach((override) => {
        const matcher = getFieldMatcher(override.matcher);
        if (matcher(field, data, [data])) {
          for (const property of override.properties) {
            if (property.id === 'custom.cellOptions' && property.value.wrapText) {
              textWrapField = field;
            }
          }
        }
      });
    });
  }

  const rendered = (
    <>
      <div
        className={tableStyles.table}
        aria-label={ariaLabel}
        aria-rowcount={ariaRowCount}
        role="table"
        ref={tableDivRef}
        style={{ width, height }}
      >
        <CustomScrollbar hideVerticalTrack={true}>
          <div className={tableStyles.tableContentWrapper(totalColumnsWidth)}>
            {!noHeader && (
              <HeaderRow headerGroups={headerGroups} showTypeIcons={showTypeIcons} tableStyles={tableStyles} />
            )}
            {itemCount > 0 ? (
              <div
                role="rowgroup"
                data-testid={selectors.components.Panels.Visualization.Table.body}
                ref={variableSizeListScrollbarRef}
              >
                <RowsList
                  headerGroups={headerGroups}
                  data={data}
                  rows={rows}
                  width={width}
                  cellHeight={cellHeight}
                  headerHeight={headerHeight}
                  rowHeight={tableStyles.rowHeight}
                  itemCount={itemCount}
                  noHeader={noHeader}
                  pageIndex={state.pagination.pageIndex}
                  listHeight={listHeight}
                  listRef={listRef}
                  tableState={state}
                  timeRange={timeRange}
                  onCellFilterAdded={onCellFilterAdded}
                  nestedDataField={nestedDataField}
                  tableStyles={tableStyles}
                  footerPaginationEnabled={Boolean(enablePagination)}
                  enableSharedCrosshair={enableSharedCrosshair}
                  initialRowIndex={initialRowIndex}
                  longestField={longestField}
                  textWrapField={textWrapField}
                  getActions={getActions}
                  replaceVariables={replaceVariables}
                  setInspectCell={setInspectCell}
                />
              </div>
            ) : (
              <div style={{ height: height - headerHeight, width }} className={tableStyles.noData}>
                {noValuesDisplayText}
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

      {inspectCell !== null && (
        <TableCellInspector
          mode={inspectCell.mode}
          value={inspectCell.value}
          onDismiss={() => {
            setInspectCell(null);
          }}
        />
      )}
    </>
  );

  if (!tableHasGeoCell) {
    return rendered;
  }

  return (
    <Suspense fallback={rendered}>
      <LazyOpenLayersProvider>{rendered}</LazyOpenLayersProvider>
    </Suspense>
  );
});

Table.displayName = 'Table';
