import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import { useCallback, useMemo, useRef, useState } from 'react';

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
import { FIRST_COLUMN_EXTRA_PADDING, getPaginationChromeHeight, TABLE } from './constants';
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
  useNativeScrollbarWidth,
  useSortedRows,
  useRowCompiler,
  useTypographyCtx,
  useHeaderTypographyCtx,
  useTextWrapFallback,
} from './hooks';
import {
  type ColumnBuildConfig,
  prepareFieldsForDisplay,
  useColumnBuilderFromFields,
  useDataGridRows,
} from './render-hooks';
import { shouldReserveScrollbarGutter } from './scrollbar';
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
  isShiftTabToHeader,
  makeStripedRowClass,
  markEdgeColumns,
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
    onFieldAddToAssistant,
    onCellAddToAssistant,
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
  const wrapFallback = useTextWrapFallback(data);
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

  const { hiddenColumns, setHiddenColumns } = useColumnViewState({
    hiddenColumns: hiddenColumnsProp,
    onHiddenColumnsChange,
    structureRev,
  });

  const orderedVisibleFields = preparedFields;

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

  const canHideAnotherColumn =
    (columnCatalog ?? orderedVisibleFields.map(getDisplayName)).filter((name) => !hiddenColumns.has(name)).length > 1;

  const handleHideColumn = useCallback(
    (displayName: string) => {
      if (!canHideAnotherColumn) {
        return;
      }
      setHiddenColumns(new Set(hiddenColumns).add(displayName));
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
    [canHideAnotherColumn, hiddenColumns, setFilter, setHiddenColumns, setSortColumns]
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
  const displayedFields = useMemo(
    () => filterFieldsByHiddenColumns(orderedVisibleFields, hiddenColumns),
    [orderedVisibleFields, hiddenColumns]
  );
  const displayedRawFields = useMemo(
    () => filterFieldsByHiddenColumns(visibleFields, hiddenColumns),
    [visibleFields, hiddenColumns]
  );

  // Catalog-only columns were necessarily hideable.
  const sidebarColumns: SidebarColumn[] = useMemo(() => {
    const capabilities = new Map(
      orderedVisibleFields.map((field) => [getDisplayName(field), { hideable: isFieldHideable(field) }])
    );

    return (columnCatalog ?? Array.from(capabilities.keys())).map((name) => ({
      name,
      ...(capabilities.get(name) ?? { hideable: true }),
    }));
  }, [columnCatalog, orderedVisibleFields]);
  // The catalog includes restored columns before they return in the transformed data.
  const hasColumnSidebar = sidebarColumns.some((column) => column.hideable);

  const [isColumnVisibilityPanelOpen, setIsColumnVisibilityPanelOpen] = useState(showColumnsSidebar);
  // Follow option changes without overriding local open/close actions on every render.
  const prevShowColumnsSidebar = useRef(showColumnsSidebar);
  if (prevShowColumnsSidebar.current !== showColumnsSidebar) {
    prevShowColumnsSidebar.current = showColumnsSidebar;
    setIsColumnVisibilityPanelOpen(showColumnsSidebar);
  }
  const [columnVisibilityPanelWidth, setColumnVisibilityPanelWidth] = useState(COLUMN_VISIBILITY_PANEL_DEFAULT_WIDTH);
  const splitterAvailableWidth = Math.max(width - COLUMN_VISIBILITY_SPLITTER_HANDLE_WIDTH, 0);
  const maxSidebarWidth = Math.min(COLUMN_VISIBILITY_PANEL_MAX_WIDTH, splitterAvailableWidth / 2);
  const sidebarWidth = clamp(columnVisibilityPanelWidth, 0, maxSidebarWidth);
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
    initialSize: sidebarWidth / Math.max(splitterAvailableWidth, 1),
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
  const columnVisibilityPanelAllocation =
    hasColumnSidebar && hasHeader && isColumnVisibilityPanelOpen
      ? sidebarWidth + COLUMN_VISIBILITY_SPLITTER_HANDLE_WIDTH + COLUMN_VISIBILITY_TABLE_BORDER_WIDTH
      : 0;
  const frameSize = tableRefreshEnabled && !noPanelPadding ? TABLE.FRAME_BORDER_WIDTH * 2 : 0;
  const fullWidth = Math.max(width - frameSize - columnVisibilityPanelAllocation, 0);

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
    hasAssistantAction: onFieldAddToAssistant != null,
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

  const [fullWidths] = useColWidths(displayedFields, fullWidth, frozenColumns, widthConfigResetKey, contentAwareWidths);

  const fullHeaderHeight = useHeaderHeight({
    hasAssistantAction: onFieldAddToAssistant != null,
    columnWidths: fullWidths,
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

  const fullRowHeight = useFlatRowHeight({
    wrapFallback,
    columnWidths: fullWidths,
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
    width: fullWidth,
    height,
    footerHeight,
    headerHeight: hasHeader ? fullHeaderHeight : 0,
    rowHeight: fullRowHeight,
    pageSize,
    noPanelPadding,
    tableRefreshEnabled,
  });
  const showPagination = enablePagination && numRows > 0;
  const scrollbarWidth = useNativeScrollbarWidth(gridRef);
  const needsScrollbarSpace = useMemo(
    () =>
      scrollbarWidth > 0 &&
      shouldReserveScrollbarGutter(
        paginatedRows,
        fullRowHeight,
        fullWidths,
        fullWidth,
        height -
          frameSize -
          (hasHeader ? fullHeaderHeight : 0) -
          footerHeight -
          (showPagination ? getPaginationChromeHeight(noPanelPadding) : 0)
      ),
    [
      scrollbarWidth,
      paginatedRows,
      fullRowHeight,
      fullWidths,
      fullWidth,
      height,
      frameSize,
      hasHeader,
      fullHeaderHeight,
      footerHeight,
      showPagination,
      noPanelPadding,
    ]
  );
  const availableWidth = fullWidth - (needsScrollbarSpace ? scrollbarWidth : 0);
  const [widths, numFrozenColsFullyInView] = useColWidths(
    displayedFields,
    availableWidth,
    frozenColumns,
    widthConfigResetKey,
    contentAwareWidths
  );
  const headerHeight = useHeaderHeight({
    hasAssistantAction: onFieldAddToAssistant != null,
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
  const rowHeight = useFlatRowHeight({
    wrapFallback,
    columnWidths: widths,
    fields: displayedFields,
    defaultHeight: defaultRowHeight,
    typographyCtx,
    maxHeight: maxRowHeight,
    noPanelPadding,
  });
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
      wrapFallback,
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
      onFieldAddToAssistant,
      onCellAddToAssistant,
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
      onHideColumn: handleHideColumn,
      // Pinning needs both column order and the frozen-column panel option.
      onOpenColumnPanel: hasColumnSidebar ? () => setIsColumnVisibilityPanelOpen(true) : undefined,
      // the first column here is a field column, so it's the one carrying the panel-edge inset
      firstColumnExtraPadding: noPanelPadding ? FIRST_COLUMN_EXTRA_PADDING : 0,
    }),
    [
      wrapFallback,
      theme,
      getCellColorInlineStyles,
      getTextColorForBackground,
      rowHeight,
      rowHeightFn,
      filter,
      getCellActions,
      onCellFilterAdded,
      onFieldAddToAssistant,
      onCellAddToAssistant,
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
      handleHideColumn,
      noPanelPadding,
    ]
  );

  const fromFields = useColumnBuilderFromFields(filterResult, columnBuildConfig);

  const { columns, cellRootRenderers } = useMemo(() => {
    // The column builder prepares display processors itself; wrapping JSON processors twice repeats units.
    const result = fromFields(displayedRawFields, widths, data, rows, sortedRows);
    return { ...result, columns: markEdgeColumns(result.columns) };
  }, [fromFields, displayedRawFields, widths, data, rows, sortedRows]);

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
      onCellClick={onCellClick}
      className={clsx(noPanelPadding && styles.firstColumnInset)}
      onCellKeyDown={({ column, row }, event) => {
        if (isShiftTabToHeader(column, row, event, columns[0].key)) {
          event.preventGridDefault();
          gridRef.current?.setActivePosition({ rowIdx: -1, idx: columns.length - 1 });
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
          maxWidth: maxSidebarWidth,
          overflow: 'hidden',
        }}
      >
        <ColumnVisibilitySidePanel
          columns={sidebarColumns}
          hiddenColumns={hiddenColumns}
          onToggleColumn={handleToggleColumnVisibility}
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
