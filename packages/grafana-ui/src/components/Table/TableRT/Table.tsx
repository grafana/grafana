import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useAbsoluteLayout,
  useExpanded,
  useFilters,
  usePagination,
  useResizeColumns,
  useSortBy,
  useTable,
} from 'react-table';
import { VariableSizeList } from 'react-window';

import { FieldType, ReducerID, getRowUniqueId, getFieldMatcher } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { TableCellHeight } from '@grafana/schema';

import { useTheme2 } from '../../../themes/ThemeContext';
import { CustomScrollbar } from '../../CustomScrollbar/CustomScrollbar';
import { Pagination } from '../../Pagination/Pagination';
import { TableCellInspector } from '../TableCellInspector';
import { useFixScrollbarContainer, useResetVariableListSizeCache } from '../hooks';
import { getInitialState, useTableStateReducer } from '../reducer';
import { FooterItem, GrafanaTableState, InspectCell, TableRTProps as Props } from '../types';
import {
  getColumns,
  sortCaseInsensitive,
  sortNumber,
  getFooterItems,
  createFooterCalculationValues,
  guessLongestField,
} from '../utils';

import { FooterRow } from './FooterRow';
import { HeaderRow } from './HeaderRow';
import { RowsList } from './RowsList';
import { useTableStyles } from './styles';

const COLUMN_MIN_WIDTH = 150;
const FOOTER_ROW_HEIGHT = 36;
const NO_DATA_TEXT = 'No data';

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

  // we need a ref to later store the `toggleAllRowsExpanded` function, returned by `useTable`.
  // We cannot simply use a variable because we need to use such function in the initialization of
  // `useTableStateReducer`, which is needed to construct options for `useTable` (the hook that returns
  // `toggleAllRowsExpanded`), and if we used a variable, that variable would be undefined at the time
  // we initialize `useTableStateReducer`.
  const toggleAllRowsExpandedRef = useRef<(value?: boolean) => void>();

  // Internal react table state reducer
  const stateReducer = useTableStateReducer({
    onColumnResize,
    onSortByChange: (state) => {
      // Collapse all rows. This prevents a known bug that causes the size of the rows to be incorrect due to
      // using `VariableSizeList` and `useExpanded` together.
      toggleAllRowsExpandedRef.current!(false);

      if (props.onSortByChange) {
        props.onSortByChange(state);
      }
    },
    data,
  });

  const hasUniqueId = !!data.meta?.uniqueRowIdFields?.length;

  const options: any = useMemo(() => {
    // This is a bit hard to type with the react-table types here, the reducer does not actually match with the
    // TableOptions.
    const options: any = {
      columns: memoizedColumns,
      data: memoizedData,
      disableResizing: !resizable,
      stateReducer: stateReducer,
      autoResetPage: false,
      initialState: getInitialState(initialSortBy, memoizedColumns),
      autoResetFilters: false,
      sortTypes: {
        // the builtin number type on react-table does not handle NaN values
        number: sortNumber,
        // should be replaced with the builtin string when react-table is upgraded,
        // see https://github.com/tannerlinsley/react-table/pull/3235
        'alphanumeric-insensitive': sortCaseInsensitive,
      },
    };
    if (hasUniqueId) {
      // row here is just always 0 because here we don't use real data but just a dummy array filled with 0.
      // See memoizedData variable above.
      options.getRowId = (row: Record<string, unknown>, relativeIndex: number) => getRowUniqueId(data, relativeIndex);

      // If we have unique field we assume we can count on it as being globally unique, and we don't need to reset when
      // data changes.
      options.autoResetExpanded = false;
    }
    return options;
  }, [initialSortBy, memoizedColumns, memoizedData, resizable, stateReducer, hasUniqueId, data]);

  const {
    getTableProps,
    headerGroups,
    footerGroups,
    rows,
    prepareRow,
    totalColumnsWidth,
    page,
    state,
    gotoPage,
    setPageSize,
    pageOptions,
    toggleAllRowsExpanded,
  } = useTable(options, useFilters, useSortBy, useAbsoluteLayout, useResizeColumns, useExpanded, usePagination);

  const extendedState = state as GrafanaTableState;
  toggleAllRowsExpandedRef.current = toggleAllRowsExpanded;

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
      headerGroups[0].headers,
      createFooterCalculationValues(rows),
      footerOptions,
      theme
    );

    setFooterItems(footerItems);
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

  useEffect(() => {
    // Reset page index when data changes
    // This is needed because react-table does not do this automatically
    // autoResetPage is set to false because setting it to true causes the issue described in
    // https://github.com/grafana/grafana/pull/67477
    if (data.length / pageSize < state.pageIndex) {
      gotoPage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useResetVariableListSizeCache(extendedState, listRef, data, hasUniqueId);
  useFixScrollbarContainer(variableSizeListScrollbarRef, tableDivRef);

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
    const numRows = rows.length;
    const displayedEnd = itemsRangeEnd < rows.length ? itemsRangeEnd : rows.length;
    paginationEl = (
      <div className={tableStyles.paginationWrapper}>
        <Pagination
          currentPage={state.pageIndex + 1}
          numberOfPages={pageOptions.length}
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

  return (
    <>
      <div
        {...getTableProps()}
        className={tableStyles.table}
        aria-label={ariaLabel}
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
                  pageIndex={state.pageIndex}
                  listHeight={listHeight}
                  listRef={listRef}
                  tableState={state}
                  prepareRow={prepareRow}
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
});

Table.displayName = 'Table';
