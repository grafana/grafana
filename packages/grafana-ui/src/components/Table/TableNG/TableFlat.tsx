import memoize from 'micro-memoize';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type Field } from '@grafana/data';
import { type DataGridHandle, type DataGridProps } from '@grafana/react-data-grid';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { clamp } from '../../../utils/clamp';
import { getTextColorForBackground as _getTextColorForBackground } from '../../../utils/colors';
import { usePanelContext } from '../../PanelChrome';
import { useSplitter } from '../../Splitter/useSplitter';
import { type DataLinksActionsTooltipState } from '../cellUtils';

import { TableDataGrid } from './TableDataGrid';
import { ColumnVisibilitySidePanel, type SidebarColumn } from './components/ColumnVisibilitySidePanel';
import { COLUMN_SETTLE_MS, FIRST_COLUMN_EXTRA_PADDING, TABLE } from './constants';
import {
  useColumnResize,
  useColumnViewState,
  useColWidths,
  useContentAwareWidths,
  useFlatRowHeight,
  useFilteredRows,
  useHeaderHeight,
  useManagedSort,
  useNotifyDisplayedRowIndices,
  usePaginatedRows,
  useScrollbarWidth,
  useSortedRows,
  useRowCompiler,
  useTypographyCtx,
  useHeaderTypographyCtx,
} from './hooks';
import {
  type ColumnBuildConfig,
  prepareFieldsForDisplay,
  useColumnBuilderFromFields,
  useDataGridRows,
} from './render-hooks';
import { getGridStyles } from './styles';
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
  getCellColorInlineStylesFactory,
  getCellLinks,
  getDefaultRowHeight,
  getDisplayName,
  getVisibleFields,
  makeStripedRowClass,
  markEdgeColumns,
  orderFieldsByDisplayNames,
  canManageColumns,
  isFieldReorderable,
  isFieldHideable,
} from './utils';

type OnCellClick = NonNullable<DataGridProps<TableRow, TableSummaryRow>['onCellClick']>;

// Flat tables have no depth-1 rows, so expandedRows is never consulted.
// Stable references avoid invalidating useDataGridRows' memo on every render.
const EMPTY_EXPANDED_ROWS: Set<string> = new Set();
const NOOP_STABLE_KEY = () => '';

// Must match useSplitter's unexported `sm` handle width.
const COLUMN_VISIBILITY_PANEL_DEFAULT_WIDTH = 220;
const COLUMN_VISIBILITY_PANEL_MIN_WIDTH = 160;
const COLUMN_VISIBILITY_PANEL_MAX_WIDTH = 400;
const COLUMN_VISIBILITY_SPLITTER_HANDLE_WIDTH = 8;
const COLUMN_VISIBILITY_TABLE_BORDER_WIDTH = 1;

export function TableFlat(props: TableNGProps) {
  const {
    cellHeight,
    data,
    disableKeyboardEvents,
    hoverOverflow,
    disableSanitizeHtml,
    jsonSyntaxHighlightingEnabled,
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
    onDisplayedRowIndicesChange,
    onSortByChange,
    showTypeIcons,
    structureRev,
    timeRange,
    transparent,
    noPanelPadding = false,
    width,
    initialRowIndex,
    sortBy,
    sortByBehavior = 'initial',
    contentAwareWidthsEnabled = false,
    tableRefreshEnabled = false,
    preventHorizontalOverflow = false,
    zebraStriping = false,
    showColumnsSidebar = false,
    columnOrder: columnOrderProp,
    onColumnOrderChange,
    hiddenColumns: hiddenColumnsProp,
    onHiddenColumnsChange,
    columnCatalog,
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
  // Measure the prepared display values so JSON cells are not treated as "[object Object]".
  const preparedFields = useMemo(() => prepareFieldsForDisplay(visibleFields, theme), [visibleFields, theme]);
  const hasHeader = !noHeader;
  const hasFooter = useMemo(
    () => visibleFields.some((field) => Boolean(field.config.custom?.footer?.reducers?.length)),
    [visibleFields]
  );
  const footerHeight = useMemo(
    () => (hasFooter ? calculateFooterHeight(visibleFields) : 0),
    [hasFooter, visibleFields]
  );

  const { columnOrder, hiddenColumns, setColumnOrder, setHiddenColumns, isControlled } = useColumnViewState({
    columnOrder: columnOrderProp,
    onColumnOrderChange,
    hiddenColumns: hiddenColumnsProp,
    onHiddenColumnsChange,
    structureRev,
  });

  const [settlingColumnKeys, setSettlingColumnKeys] = useState<ReadonlySet<string>>(() => new Set());
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
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

  // A partial order cannot place unmentioned columns deterministically.
  const handleColumnsReorder = useCallback(
    (sourceColumnKey: string, targetColumnKey: string) => {
      const next = [...(columnOrder ?? columnCatalog ?? visibleFields.map(getDisplayName))];
      const sourceIndex = next.indexOf(sourceColumnKey);
      const targetIndex = next.indexOf(targetColumnKey);

      if (sourceIndex < 0 || targetIndex < 0) {
        return;
      }

      next.splice(targetIndex, 0, next.splice(sourceIndex, 1)[0]);
      setColumnOrder(next);
      markColumnsSettling([sourceColumnKey, targetColumnKey]);
    },
    [columnOrder, columnCatalog, markColumnsSettling, setColumnOrder, visibleFields]
  );

  const orderedVisibleFields = orderFieldsByDisplayNames(preparedFields, columnOrder);

  // Use the pre-hide fields so the sidebar remains available after hiding a column.
  const hasColumnSidebar = canManageColumns(orderedVisibleFields);
  const hasReorderableColumn = orderedVisibleFields.some(isFieldReorderable);

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
  useNotifyDisplayedRowIndices(sortedRows, onDisplayedRowIndicesChange);

  // Controlled data has already had hidden fields removed.
  const canHideAnotherColumn = isControlled
    ? orderedVisibleFields.length > 1
    : orderedVisibleFields.length - hiddenColumns.size > 1;

  const handleHideColumn = useCallback(
    (displayName: string) => {
      if (canHideAnotherColumn) {
        setHiddenColumns(new Set(hiddenColumns).add(displayName));
      }
      if (props.rowTransformationsEnabled) {
        return;
      }
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
    [canHideAnotherColumn, hiddenColumns, setFilter, setHiddenColumns, setSortColumns, props.rowTransformationsEnabled]
  );

  const handleToggleColumnVisibility = useCallback(
    (displayName: string, visible: boolean) => {
      if (!visible) {
        handleHideColumn(displayName);
        return;
      }
      const next = new Set(hiddenColumns);
      next.delete(displayName);
      setHiddenColumns(next);
    },
    [handleHideColumn, hiddenColumns, setHiddenColumns]
  );

  // Also filter controlled data during the render before its transformed frame arrives.
  const displayedFields = filterFieldsByHiddenColumns(orderedVisibleFields, hiddenColumns);

  // Catalog-only columns were necessarily hideable; infer reorderability from the remaining fields.
  const sidebarColumns: SidebarColumn[] = useMemo(() => {
    const capabilities = new Map(
      orderedVisibleFields.map((field) => [
        getDisplayName(field),
        { reorderable: isFieldReorderable(field), hideable: isFieldHideable(field) },
      ])
    );

    return (columnCatalog ?? Array.from(capabilities.keys())).map((name) => ({
      name,
      ...(capabilities.get(name) ?? { reorderable: hasReorderableColumn, hideable: true }),
    }));
  }, [columnCatalog, orderedVisibleFields, hasReorderableColumn]);

  const [isColumnVisibilityPanelOpen, setIsColumnVisibilityPanelOpen] = useState(showColumnsSidebar);
  // Follow option changes without overriding local open/close actions on every render.
  const prevShowColumnsSidebar = useRef(showColumnsSidebar);
  if (prevShowColumnsSidebar.current !== showColumnsSidebar) {
    prevShowColumnsSidebar.current = showColumnsSidebar;
    setIsColumnVisibilityPanelOpen(showColumnsSidebar);
  }
  const [columnVisibilityPanelWidth, setColumnVisibilityPanelWidth] = useState(COLUMN_VISIBILITY_PANEL_DEFAULT_WIDTH);
  const handlePanelResizing = useCallback((_flexFraction: number, sidebarPixels: number) => {
    setColumnVisibilityPanelWidth(sidebarPixels);
  }, []);
  const handlePanelResizeEnd = useCallback((_flexFraction: number, sidebarPixels: number) => {
    if (sidebarPixels < COLUMN_VISIBILITY_PANEL_MIN_WIDTH) {
      setIsColumnVisibilityPanelOpen(false);
      setColumnVisibilityPanelWidth(COLUMN_VISIBILITY_PANEL_DEFAULT_WIDTH);
      return;
    }
    setColumnVisibilityPanelWidth(sidebarPixels);
  }, []);
  // useSplitter applies the fraction after reserving the handle, so exclude it from the denominator.
  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: 'row',
    initialSize: clamp(
      columnVisibilityPanelWidth / Math.max(width - COLUMN_VISIBILITY_SPLITTER_HANDLE_WIDTH, 1),
      0,
      0.5
    ),
    dragPosition: 'middle',
    handleSize: 'sm',
    onResizing: handlePanelResizing,
    onSizeChanged: handlePanelResizeEnd,
  });

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
  const columnVisibilityPanelAllocation =
    hasColumnSidebar && isColumnVisibilityPanelOpen
      ? columnVisibilityPanelWidth + COLUMN_VISIBILITY_SPLITTER_HANDLE_WIDTH + COLUMN_VISIBILITY_TABLE_BORDER_WIDTH
      : 0;
  const availableWidth = useMemo(
    () =>
      width -
      scrollbarWidth -
      columnVisibilityPanelAllocation -
      (tableRefreshEnabled && !noPanelPadding ? TABLE.FRAME_BORDER_WIDTH * 2 : 0),
    [width, scrollbarWidth, columnVisibilityPanelAllocation, tableRefreshEnabled, noPanelPadding]
  );

  const getCellColorInlineStyles = useMemo(() => getCellColorInlineStylesFactory(theme), [theme]);
  const getTextColorForBackground = useMemo(() => memoize(_getTextColorForBackground, { maxSize: 1000 }), []);

  const typographyCtx = useTypographyCtx(theme);
  const headerTypographyCtx = useHeaderTypographyCtx(theme);

  const frozenColumns = _frozenColumns;

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
    hasHeader,
    getActions: getCellActions,
    tableRefreshEnabled,
    filter,
    hasColumnSidebar,
    noPanelPadding,
    preventHorizontalOverflow,
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
    showTypeIcons: showTypeIcons ?? false,
    typographyCtx: headerTypographyCtx,
    noPanelPadding,
    tableRefreshEnabled,
    filter,
    hasColumnSidebar,
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
    noPanelPadding,
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
    noPanelPadding,
    tableRefreshEnabled,
  });
  const showPagination = enablePagination && numRows > 0;
  const styles = useStyles2(getGridStyles, showPagination, transparent, tableRefreshEnabled, noPanelPadding);

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
      hoverOverflow,
      disableSanitizeHtml,
      jsonSyntaxHighlightingEnabled,
      showTypeIcons,
      timeRange,
      tableRefreshEnabled,
      typographyCtx,
      hasColumnSidebar,
      settlingColumnKeys,
      onHideColumn: handleHideColumn,
      // Pinning needs both column order and the frozen-column panel option.
      onTogglePin: undefined,
      onOpenColumnPanel: hasColumnSidebar ? () => setIsColumnVisibilityPanelOpen(true) : undefined,
      pinnedColumns: undefined,
      // the first column here is a field column, so it's the one carrying the panel-edge inset
      firstColumnExtraPadding: noPanelPadding ? FIRST_COLUMN_EXTRA_PADDING : 0,
    }),
    [
      theme,
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
      hoverOverflow,
      disableSanitizeHtml,
      jsonSyntaxHighlightingEnabled,
      setFilter,
      showTypeIcons,
      timeRange,
      tableRefreshEnabled,
      typographyCtx,
      hasColumnSidebar,
      settlingColumnKeys,
      handleHideColumn,
      noPanelPadding,
    ]
  );

  const fromFields = useColumnBuilderFromFields(filterResult, columnBuildConfig);

  const { columns, cellRootRenderers } = useMemo(() => {
    const result = fromFields(displayedFields, widths, data, rows, sortedRows);
    return { ...result, columns: markEdgeColumns(result.columns) };
  }, [fromFields, displayedFields, widths, data, rows, sortedRows]);

  // invalidate columns on every structureRev change to support width editing in fieldConfig.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const structureRevColumns = useMemo(() => columns, [columns, structureRev]);
  const renderCellRoot: CellRootRenderer = useCallback(
    (key, cellProps) => cellRootRenderers[cellProps.column.key](key, cellProps),
    [cellRootRenderers]
  );

  // Striping is applied through `rowClass` rather than react-data-grid's own row parity - see
  // `makeStripedRowClass`.
  const rowClass = useMemo(
    () => (zebraStriping ? makeStripedRowClass(paginatedRows) : undefined),
    [zebraStriping, paginatedRows]
  );

  const dataGrid = (
    <TableDataGrid
      role="grid"
      gridRef={gridRef}
      columns={structureRevColumns}
      rows={paginatedRows}
      rowClass={rowClass}
      noValue={noValue}
      renderers={{ renderRow, renderCell: renderCellRoot }}
      columnWidths={resetColumnWidths}
      onColumnWidthsChange={resetColumnWidths != null ? () => {} : undefined}
      onColumnResize={resizeHandler}
      onColumnsReorder={hasReorderableColumn ? handleColumnsReorder : undefined}
      onCellClick={onCellClick}
      className={noPanelPadding ? styles.firstColumnInset : undefined}
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
      getRowHeight={rowHeightFn}
      height={height}
      enableVirtualization={enableVirtualization}
      hasFooter={hasFooter}
      footerHeight={footerHeight}
      noHeader={!!noHeader}
      headerHeight={headerHeight}
      transparent={transparent}
      tableRefreshEnabled={tableRefreshEnabled}
      zebraStriping={zebraStriping}
      showColumnSidebarBorder={hasColumnSidebar && isColumnVisibilityPanelOpen}
      noPanelPadding={noPanelPadding}
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

  if (!hasColumnSidebar || !hasHeader || !isColumnVisibilityPanelOpen) {
    return dataGrid;
  }

  return (
    // The splitter needs an explicit height to preserve the grid's percentage-based scroll region.
    <div {...containerProps} style={{ height: '100%' }}>
      <div
        {...primaryProps}
        style={{
          ...primaryProps.style,
          // Override the flex min-content width so the pane can cross the close threshold.
          minWidth: 0,
          maxWidth: COLUMN_VISIBILITY_PANEL_MAX_WIDTH,
          overflow: 'hidden',
        }}
      >
        <ColumnVisibilitySidePanel
          columns={sidebarColumns}
          hiddenColumns={hiddenColumns}
          onToggleColumn={handleToggleColumnVisibility}
          onColumnsReorder={handleColumnsReorder}
          onClose={() => setIsColumnVisibilityPanelOpen(false)}
          headerHeight={headerHeight}
          transparent={transparent}
          willCloseOnRelease={columnVisibilityPanelWidth < COLUMN_VISIBILITY_PANEL_MIN_WIDTH}
        />
      </div>
      <div {...splitterProps} />
      <div {...secondaryProps} style={{ ...secondaryProps.style, minWidth: 0, flexDirection: 'column' }}>
        {dataGrid}
      </div>
    </div>
  );
}
