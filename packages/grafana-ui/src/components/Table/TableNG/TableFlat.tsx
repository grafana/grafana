import memoize from 'micro-memoize';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type Field } from '@grafana/data';
import { type DataGridHandle, type DataGridProps } from '@grafana/react-data-grid';

import { useTheme2 } from '../../../themes/ThemeContext';
import { getTextColorForBackground as _getTextColorForBackground } from '../../../utils/colors';
import { usePanelContext } from '../../PanelChrome';
import { type DataLinksActionsTooltipState } from '../cellUtils';

import { TableDataGrid } from './TableDataGrid';
import { COLUMN_SETTLE_MS, TABLE } from './constants';
import {
  useColumnResize,
  useColWidths,
  useContentAwareWidths,
  useFlatRowHeight,
  useFilteredRows,
  useHeaderHeight,
  useManagedSort,
  usePaginatedRows,
  useScrollbarWidth,
  useSortedRows,
  useRowCompiler,
  useTypographyCtx,
} from './hooks';
import { type ColumnBuildConfig, useColumnBuilderFromFields, useDataGridRows } from './render-hooks';
import {
  type CellRootRenderer,
  type InspectCellProps,
  type TableColumn,
  type TableNGProps,
  type TableRow,
  type TableSummaryRow,
} from './types';
import {
  calculateFooterHeight,
  filterFieldsByHiddenColumns,
  getApplyToRowBgFn,
  getCellColorInlineStylesFactory,
  getCellLinks,
  getDefaultRowHeight,
  getDisplayName,
  getVisibleFields,
  orderFieldsByDisplayNames,
  orderFieldsByPinnedColumns,
} from './utils';

type OnCellClick = NonNullable<DataGridProps<TableRow, TableSummaryRow>['onCellClick']>;

// Flat tables have no depth-1 rows, so expandedRows is never consulted.
// Stable references avoid invalidating useDataGridRows' memo on every render.
const EMPTY_EXPANDED_ROWS: Set<string> = new Set();
const NOOP_STABLE_KEY = () => '';

export function TableFlat(props: TableNGProps) {
  const {
    cellHeight,
    data,
    disableKeyboardEvents,
    disableSanitizeHtml,
    enablePagination = false,
    enableSharedCrosshair = false,
    enableVirtualization,
    frozenColumns: _frozenColumns = 0,
    getActions = () => [],
    height,
    pageSize,
    maxRowHeight: _maxRowHeight,
    noHeader,
    noValue,
    onCellFilterAdded,
    onColumnResize,
    onSortByChange,
    showTypeIcons,
    structureRev,
    timeRange,
    transparent,
    width,
    initialRowIndex,
    sortBy,
    sortByBehavior = 'initial',
    contentAwareWidthsEnabled = false,
    tableRefreshEnabled = false,
  } = props;

  const theme = useTheme2();
  const panelContext = usePanelContext();
  const userCanExecuteActions = useMemo(() => panelContext.canExecuteActions?.() ?? false, [panelContext]);

  const getCellActions = useCallback(
    (field: Field, rowIdx: number) => {
      if (!userCanExecuteActions) {
        return [];
      }
      return getActions(data, field, rowIdx);
    },
    [getActions, data, userCanExecuteActions]
  );

  const visibleFields = useMemo(() => getVisibleFields(data.fields), [data.fields]);
  const hasHeader = !noHeader;
  const hasFooter = useMemo(
    () => visibleFields.some((field) => Boolean(field.config.custom?.footer?.reducers?.length)),
    [visibleFields]
  );
  const footerHeight = useMemo(
    () => (hasFooter ? calculateFooterHeight(visibleFields) : 0),
    [hasFooter, visibleFields]
  );

  // `table.refresh`: ephemeral column order/visibility/pinning from the header column menu and
  // sidebar. `undefined` means "use field order/config as-is". Reset whenever the query
  // structurally changes, same as the column-width reset below — state pointing at columns that no
  // longer exist would be confusing rather than helpful.
  const [columnOrder, setColumnOrder] = useState<string[]>();
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(() => new Set());
  const [pinnedColumns, setPinnedColumns] = useState<string[]>();
  const [settlingColumnKeys, setSettlingColumnKeys] = useState<ReadonlySet<string>>(() => new Set());
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setColumnOrder(undefined);
    setHiddenColumns(new Set());
    setPinnedColumns(undefined);
    setSettlingColumnKeys(new Set());
  }, [structureRev]);

  useEffect(() => {
    return () => clearTimeout(settleTimeoutRef.current);
  }, []);

  const markColumnsSettling = useCallback((displayNames: string[]) => {
    setSettlingColumnKeys(new Set(displayNames));
    clearTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = setTimeout(() => setSettlingColumnKeys(new Set()), COLUMN_SETTLE_MS);
  }, []);

  const handleColumnsReorder = useCallback(
    (sourceColumnKey: string, targetColumnKey: string) => {
      setColumnOrder((current) => {
        const next = [...(current ?? visibleFields.map(getDisplayName))];
        const sourceIndex = next.indexOf(sourceColumnKey);
        const targetIndex = next.indexOf(targetColumnKey);
        if (sourceIndex < 0 || targetIndex < 0) {
          return current;
        }
        next.splice(targetIndex, 0, next.splice(sourceIndex, 1)[0]);
        return next;
      });
      markColumnsSettling([sourceColumnKey, targetColumnKey]);
    },
    [markColumnsSettling, visibleFields]
  );

  // only reorder when the flag is on, so a bug here can't affect the flag-off table at all.
  const orderedVisibleFields = tableRefreshEnabled
    ? orderFieldsByDisplayNames(visibleFields, columnOrder)
    : visibleFields;

  const resizeHandler = useColumnResize(onColumnResize);

  const frameToRecords = useRowCompiler(data);
  const rows = useMemo(() => frameToRecords(data), [frameToRecords, data]);

  const { rows: filteredRows, filter, setFilter, filterResult } = useFilteredRows(rows, data.fields);
  const {
    rows: sortedRows,
    sortColumns,
    setSortColumns,
  } = useSortedRows(filteredRows, data.fields, [], { initialSortBy: sortBy });

  useManagedSort({ sortByBehavior, setSortColumns, sortBy });

  // `frozenColumns` is the persisted baseline pin count from field config — a column pinned
  // through the header menu/sidebar is layered on top of it as ephemeral state, so the baseline is
  // still respected until the user explicitly changes it.
  const configuredPinnedColumns = useMemo(
    () => orderedVisibleFields.slice(0, _frozenColumns).map(getDisplayName),
    [orderedVisibleFields, _frozenColumns]
  );
  const pinnedColumnSet = useMemo(
    () => new Set(pinnedColumns ?? configuredPinnedColumns),
    [pinnedColumns, configuredPinnedColumns]
  );

  const handleHideColumn = useCallback(
    (displayName: string) => {
      setHiddenColumns((current) => {
        // never hide the last remaining visible column
        if (orderedVisibleFields.length - current.size <= 1) {
          return current;
        }
        return new Set(current).add(displayName);
      });
      setFilter((current) => {
        if (!(displayName in current)) {
          return current;
        }
        const next = { ...current };
        delete next[displayName];
        return next;
      });
      setSortColumns((current) => current.filter((sort) => sort.columnKey !== displayName));
    },
    [orderedVisibleFields, setFilter, setSortColumns]
  );

  // Re-showing a hidden column has no entry point yet — the header menu only offers "Hide column" —
  // so a toggle-back-on handler is added alongside the column-visibility sidebar in a follow-up
  // commit, which is the first UI that needs one.

  const handleTogglePin = useCallback(
    (displayName: string) => {
      setPinnedColumns((current) => {
        const effective = current ?? configuredPinnedColumns;
        return effective.includes(displayName)
          ? effective.filter((column) => column !== displayName)
          : [...effective, displayName];
      });
      markColumnsSettling([displayName]);
    },
    [configuredPinnedColumns, markColumnsSettling]
  );

  // only filter/pin when the flag is on, so a bug here can't affect the flag-off table at all.
  const displayedFields = tableRefreshEnabled
    ? filterFieldsByHiddenColumns(orderFieldsByPinnedColumns(orderedVisibleFields, pinnedColumnSet), hiddenColumns)
    : orderedVisibleFields;

  const [inspectCell, setInspectCell] = useState<InspectCellProps | null>(null);
  const [tooltipState, setTooltipState] = useState<DataLinksActionsTooltipState>();
  const onCellClick: OnCellClick = useCallback(
    ({ column, row }, ev) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const field = (column as unknown as TableColumn).field;

      if (ev.target instanceof HTMLElement && ev.target.closest('a[aria-haspopup], .rdg-cell')?.matches('a')) {
        const rowIdx = row.__index;
        setTooltipState({
          coords: { clientX: ev.clientX, clientY: ev.clientY },
          links: getCellLinks(field, rowIdx),
          actions: getCellActions(field, rowIdx),
        });
        ev.preventGridDefault();
      }
    },
    [getCellActions]
  );

  const gridRef = useRef<DataGridHandle>(null);
  const scrollbarWidth = useScrollbarWidth(gridRef, height);
  // A scrollbar appearing/disappearing changes how much room the columns have, so factor it out.
  const availableWidth = useMemo(() => width - scrollbarWidth, [width, scrollbarWidth]);

  const getCellColorInlineStyles = useMemo(() => getCellColorInlineStylesFactory(theme), [theme]);
  const applyToRowBgFn = useMemo(
    () => getApplyToRowBgFn(data.fields, getCellColorInlineStyles) ?? undefined,
    [data.fields, getCellColorInlineStyles]
  );
  const getTextColorForBackground = useMemo(() => memoize(_getTextColorForBackground, { maxSize: 1000 }), []);

  const typographyCtx = useTypographyCtx(theme);

  const displayedPinnedColumnCount = tableRefreshEnabled
    ? displayedFields.filter((field) => pinnedColumnSet.has(getDisplayName(field))).length
    : 0;
  const frozenColumns = tableRefreshEnabled ? displayedPinnedColumnCount : _frozenColumns;

  // When a width override is removed from field config, the configured-width count drops. That
  // change to field.config.custom.width is a mutation on the existing field objects, so it doesn't
  // re-trigger memoization on its own. We detect the drop here and pass a fresh reset key to force
  // recomputation and clear react-data-grid's internal column widths so columns re-flow to auto.
  const configuredWidthCount = visibleFields.reduce(
    (count, field) => count + (field.config.custom?.width != null ? 1 : 0),
    0
  );
  const prevConfiguredWidthCount = useRef(configuredWidthCount);
  const widthConfigResetKey = configuredWidthCount < prevConfiguredWidthCount.current ? Symbol() : undefined;
  const resetColumnWidths = widthConfigResetKey != null ? new Map() : undefined;

  prevConfiguredWidthCount.current = configuredWidthCount;

  const contentAwareWidths = useContentAwareWidths({
    enabled: contentAwareWidthsEnabled,
    typographyCtx,
    showTypeIcons,
    getActions: getCellActions,
    sortColumns,
    tableRefreshEnabled,
    filter,
  });

  const [widths, numFrozenColsFullyInView] = useColWidths(
    displayedFields,
    availableWidth,
    frozenColumns,
    widthConfigResetKey,
    contentAwareWidths
  );

  const headerHeight = useHeaderHeight({
    columnWidths: widths,
    fields: displayedFields,
    enabled: hasHeader,
    sortColumns,
    showTypeIcons: showTypeIcons ?? false,
    typographyCtx,
  });
  const maxRowHeight = _maxRowHeight != null ? Math.max(TABLE.LINE_HEIGHT, _maxRowHeight) : undefined;

  const defaultRowHeight = useMemo(
    () => getDefaultRowHeight(theme, visibleFields, cellHeight),
    [theme, visibleFields, cellHeight]
  );

  const rowHeight = useFlatRowHeight({
    columnWidths: widths,
    fields: displayedFields,
    defaultHeight: defaultRowHeight,
    typographyCtx,
    maxHeight: maxRowHeight,
  });

  const {
    rows: paginatedRows,
    page,
    setPage,
    numPages,
    numRows,
    pageRangeStart,
    pageRangeEnd,
    smallPagination,
  } = usePaginatedRows(sortedRows, {
    enabled: enablePagination,
    width: availableWidth,
    height,
    footerHeight,
    headerHeight: hasHeader ? headerHeight : 0,
    rowHeight,
    pageSize,
  });

  const rowHeightFn = useMemo((): ((row: TableRow) => number) => {
    if (typeof rowHeight === 'function') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return rowHeight as unknown as (row: TableRow) => number;
    }
    if (typeof rowHeight === 'string') {
      return () => TABLE.MAX_CELL_HEIGHT;
    }
    return () => rowHeight;
  }, [rowHeight]);

  const renderRow = useDataGridRows(
    data.fields,
    panelContext,
    EMPTY_EXPANDED_ROWS,
    enableSharedCrosshair,
    NOOP_STABLE_KEY
  );

  const columnBuildConfig = useMemo(
    (): ColumnBuildConfig => ({
      theme,
      applyToRowBgFn,
      getCellColorInlineStyles,
      getTextColorForBackground,
      rowHeight,
      rowHeightFn,
      filter,
      setFilter,
      setInspectCell,
      gridRef,
      getCellActions,
      onCellFilterAdded,
      frozenColumns,
      numFrozenColsFullyInView,
      maxRowHeight,
      disableKeyboardEvents,
      disableSanitizeHtml,
      showTypeIcons,
      timeRange,
      tableRefreshEnabled,
      enableColumnReorder: tableRefreshEnabled,
      settlingColumnKeys,
      onHideColumn: tableRefreshEnabled ? handleHideColumn : undefined,
      onTogglePin: tableRefreshEnabled ? handleTogglePin : undefined,
      pinnedColumns: tableRefreshEnabled ? pinnedColumnSet : undefined,
    }),
    [
      theme,
      applyToRowBgFn,
      getCellColorInlineStyles,
      getTextColorForBackground,
      rowHeight,
      rowHeightFn,
      filter,
      getCellActions,
      onCellFilterAdded,
      frozenColumns,
      numFrozenColsFullyInView,
      maxRowHeight,
      disableKeyboardEvents,
      disableSanitizeHtml,
      setFilter,
      showTypeIcons,
      timeRange,
      tableRefreshEnabled,
      settlingColumnKeys,
      handleHideColumn,
      handleTogglePin,
      pinnedColumnSet,
    ]
  );

  const fromFields = useColumnBuilderFromFields(filterResult, columnBuildConfig);

  const { columns, cellRootRenderers } = useMemo(
    () => fromFields(displayedFields, widths, data, rows, sortedRows),
    [fromFields, displayedFields, widths, data, rows, sortedRows]
  );

  // invalidate columns on every structureRev change to support width editing in fieldConfig.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const structureRevColumns = useMemo(() => columns, [columns, structureRev]);
  const renderCellRoot: CellRootRenderer = useCallback(
    (key, cellProps) => cellRootRenderers[cellProps.column.key](key, cellProps),
    [cellRootRenderers]
  );

  return (
    <TableDataGrid
      role="grid"
      gridRef={gridRef}
      columns={structureRevColumns}
      rows={paginatedRows}
      noValue={noValue}
      renderers={{ renderRow, renderCell: renderCellRoot }}
      columnWidths={resetColumnWidths}
      onColumnWidthsChange={resetColumnWidths != null ? () => {} : undefined}
      onColumnResize={resizeHandler}
      onColumnsReorder={tableRefreshEnabled ? handleColumnsReorder : undefined}
      onCellClick={onCellClick}
      onCellKeyDown={({ column, row }, event) => {
        if (column.key === columns[0].key && row.__index === 0 && event.shiftKey && event.key === 'Tab') {
          event.preventGridDefault();
          gridRef.current?.selectCell({ rowIdx: -1, idx: columns.length - 1 });
          return;
        }
        if (disableKeyboardEvents) {
          event.preventGridDefault();
        }
      }}
      sortColumns={sortColumns}
      setSortColumns={setSortColumns}
      onSortByChange={onSortByChange}
      rowHeight={rowHeight}
      enableVirtualization={enableVirtualization}
      hasFooter={hasFooter}
      footerHeight={footerHeight}
      noHeader={!!noHeader}
      headerHeight={headerHeight}
      transparent={transparent}
      tableRefreshEnabled={tableRefreshEnabled}
      initialRowIndex={initialRowIndex}
      sortedRows={sortedRows}
      enablePagination={enablePagination}
      numRows={numRows}
      page={page}
      setPage={setPage}
      numPages={numPages}
      pageRangeStart={pageRangeStart}
      pageRangeEnd={pageRangeEnd}
      smallPagination={smallPagination}
      tooltipState={tooltipState}
      onTooltipClose={() => setTooltipState(undefined)}
      inspectCell={inspectCell}
      onInspectCellDismiss={() => setInspectCell(null)}
    />
  );
}
