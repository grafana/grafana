import { css } from '@emotion/css';
import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type DataGridHandle, type DataGridProps } from '@grafana/react-data-grid';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { getTextColorForBackground as _getTextColorForBackground } from '../../../utils/colors';
import { usePanelContext } from '../../PanelChrome';
import { useSplitter } from '../../Splitter/useSplitter';
import { type DataLinksActionsTooltipState } from '../cellUtils';

import { TableDataGrid } from './TableDataGrid';
import {
  COLUMN_VISIBILITY_PANEL_DEFAULT_WIDTH,
  COLUMN_VISIBILITY_PANEL_MAX_WIDTH,
  COLUMN_VISIBILITY_PANEL_MIN_WIDTH,
  COLUMN_VISIBILITY_RAIL_WIDTH,
  ColumnVisibilitySidePanel,
} from './components/ColumnVisibilitySidePanel';
import { TABLE } from './constants';
import {
  useColumnResize,
  useColWidths,
  useFlatRowHeight,
  useFilteredRows,
  useHeaderHeight,
  useManagedSort,
  usePaginatedRows,
  useScrollbarWidth,
  useSortedRows,
  useRowCompiler,
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
  createTypographyContext,
  extractPixelValue,
  getApplyToRowBgFn,
  getCellColorInlineStylesFactory,
  getCellLinks,
  getDefaultRowHeight,
  getDisplayName,
  getVisibleFields,
  filterFieldsByHiddenColumns,
  orderFieldsByDisplayNames,
  orderFieldsByPinnedColumns,
} from './utils';

type OnCellClick = NonNullable<DataGridProps<TableRow, TableSummaryRow>['onCellClick']>;

// Flat tables have no depth-1 rows, so expandedRows is never consulted.
// Stable references avoid invalidating useDataGridRows' memo on every render.
const EMPTY_EXPANDED_ROWS: Set<string> = new Set();
const NOOP_STABLE_KEY = () => '';
const COLUMN_SETTLE_MS = 280;
const COLUMN_VISIBILITY_SPLITTER_SIZE = 4;
const SPLITTER_DRAG_THRESHOLD = 3;

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
    maxRowHeight: _maxRowHeight,
    noHeader,
    noValue,
    onCellFilterAdded,
    onColumnResize,
    onGroupByColumn,
    onSortByChange,
    showTypeIcons,
    structureRev,
    timeRange,
    transparent,
    width,
    initialRowIndex,
    sortBy,
    sortByBehavior = 'initial',
  } = props;

  const theme = useTheme2();
  const splitterStyles = useStyles2(getColumnVisibilitySplitterStyles);
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
  const [columnOrder, setColumnOrder] = useState<string[]>();
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(() => new Set());
  const [pinnedColumns, setPinnedColumns] = useState<string[]>();
  const [isColumnVisibilityPanelOpen, setIsColumnVisibilityPanelOpen] = useState(false);
  const [columnVisibilityPanelWidth, setColumnVisibilityPanelWidth] = useState(COLUMN_VISIBILITY_PANEL_DEFAULT_WIDTH);
  const [settlingColumnKeys, setSettlingColumnKeys] = useState<ReadonlySet<string>>(() => new Set());
  const settleTimeoutRef = useRef<number>();

  useEffect(() => {
    setColumnOrder(undefined);
    setHiddenColumns(new Set());
    setPinnedColumns(undefined);
    setSettlingColumnKeys(new Set());
  }, [structureRev]);

  useEffect(
    () => () => {
      if (settleTimeoutRef.current) {
        window.clearTimeout(settleTimeoutRef.current);
      }
    },
    []
  );

  const orderedVisibleFields = useMemo(
    () => orderFieldsByDisplayNames(visibleFields, columnOrder),
    [visibleFields, columnOrder]
  );
  const configuredPinnedColumns = useMemo(
    () => orderedVisibleFields.slice(0, _frozenColumns).map(getDisplayName),
    [orderedVisibleFields, _frozenColumns]
  );
  const effectivePinnedColumns = pinnedColumns ?? configuredPinnedColumns;
  const pinnedColumnSet = useMemo(() => new Set(effectivePinnedColumns), [effectivePinnedColumns]);
  const pinnedOrderedVisibleFields = useMemo(
    () => orderFieldsByPinnedColumns(orderedVisibleFields, pinnedColumnSet),
    [orderedVisibleFields, pinnedColumnSet]
  );
  const displayedFields = useMemo(
    () => filterFieldsByHiddenColumns(pinnedOrderedVisibleFields, hiddenColumns),
    [pinnedOrderedVisibleFields, hiddenColumns]
  );
  const displayedPinnedColumnCount = useMemo(
    () => displayedFields.filter((field) => pinnedColumnSet.has(getDisplayName(field))).length,
    [displayedFields, pinnedColumnSet]
  );
  const hasHeader = !noHeader;
  const hasFooter = useMemo(
    () => visibleFields.some((field) => Boolean(field.config.custom?.footer?.reducers?.length)),
    [visibleFields]
  );
  const footerHeight = useMemo(
    () => (hasFooter ? calculateFooterHeight(visibleFields) : 0),
    [hasFooter, visibleFields]
  );

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

  const handleHideColumn = useCallback(
    (displayName: string) => {
      setHiddenColumns((current) => {
        const visibleCount = orderedVisibleFields.filter((field) => !current.has(getDisplayName(field))).length;
        return current.has(displayName) || visibleCount <= 1 ? current : new Set([...current, displayName]);
      });
      setFilter((current) => {
        if (!(displayName in current)) {
          return current;
        }
        const next = { ...current };
        delete next[displayName];
        return next;
      });
      setSortColumns((current) => current.filter(({ columnKey }) => columnKey !== displayName));
    },
    [orderedVisibleFields, setFilter, setSortColumns]
  );

  const handleToggleColumnVisibility = useCallback(
    (displayName: string, visible: boolean) => {
      if (!visible) {
        handleHideColumn(displayName);
        return;
      }
      setHiddenColumns((current) => {
        if (!current.has(displayName)) {
          return current;
        }
        const next = new Set(current);
        next.delete(displayName);
        return next;
      });
    },
    [handleHideColumn]
  );

  const markColumnsSettling = useCallback((columnKeys: string[]) => {
    setSettlingColumnKeys(new Set(columnKeys));
    if (settleTimeoutRef.current) {
      window.clearTimeout(settleTimeoutRef.current);
    }
    settleTimeoutRef.current = window.setTimeout(() => {
      setSettlingColumnKeys(new Set());
      settleTimeoutRef.current = undefined;
    }, COLUMN_SETTLE_MS);
  }, []);

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
  const columnVisibilityPanelMaxWidth = Math.max(
    COLUMN_VISIBILITY_PANEL_MIN_WIDTH,
    Math.min(COLUMN_VISIBILITY_PANEL_MAX_WIDTH, width - 100)
  );
  const columnVisibilityPanelSize = isColumnVisibilityPanelOpen
    ? Math.min(columnVisibilityPanelWidth, columnVisibilityPanelMaxWidth)
    : 0;
  const columnVisibilityPanelAllocation = hasHeader
    ? columnVisibilityPanelSize + COLUMN_VISIBILITY_SPLITTER_SIZE
    : 0;
  const handlePanelResize = useCallback(
    (_size: number, firstPanePixels: number) => {
      if (!isColumnVisibilityPanelOpen) {
        setIsColumnVisibilityPanelOpen(true);
      }
      setColumnVisibilityPanelWidth(
        Math.max(COLUMN_VISIBILITY_PANEL_MIN_WIDTH, Math.min(firstPanePixels, columnVisibilityPanelMaxWidth))
      );
    },
    [columnVisibilityPanelMaxWidth, isColumnVisibilityPanelOpen]
  );
  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: 'row',
    initialSize: columnVisibilityPanelSize / Math.max(1, width - COLUMN_VISIBILITY_SPLITTER_SIZE),
    dragPosition: 'middle',
    handleSize: 'xs',
    onResizing: handlePanelResize,
    onSizeChanged: handlePanelResize,
  });
  const splitterPointerState = useRef({ startX: 0, moved: false });
  const splitterHookActive = useRef(false);
  // `width` may already be debounced by RefactoredTableNG. scrollbarWidth never is, so a scrollbar
  // appearing/disappearing re-sizes columns immediately instead of lagging behind that debounce.
  const availableWidth = useMemo(
    () => Math.max(1, width - scrollbarWidth - columnVisibilityPanelAllocation),
    [columnVisibilityPanelAllocation, scrollbarWidth, width]
  );

  const getCellColorInlineStyles = useMemo(() => getCellColorInlineStylesFactory(theme), [theme]);
  const applyToRowBgFn = useMemo(
    () => getApplyToRowBgFn(data.fields, getCellColorInlineStyles) ?? undefined,
    [data.fields, getCellColorInlineStyles]
  );
  const getTextColorForBackground = useMemo(() => memoize(_getTextColorForBackground, { maxSize: 1000 }), []);

  const typographyCtx = useMemo(
    () =>
      createTypographyContext(
        theme.typography.fontSize,
        theme.typography.fontFamily,
        extractPixelValue(theme.typography.body.letterSpacing!) * theme.typography.fontSize
      ),
    [theme]
  );

  const frozenColumns = displayedPinnedColumnCount;

  // When a width override is removed from field config, the configured-width count drops. That
  // change to field.config.custom.width is a mutation on the existing field objects, so it doesn't
  // re-trigger memoization on its own. We detect the drop here and pass a fresh reset key to force
  // recomputation and clear react-data-grid's internal column widths so columns re-flow to auto.
  const configuredWidthCount = displayedFields.reduce(
    (count, field) => count + (field.config.custom?.width != null ? 1 : 0),
    0
  );
  const prevConfiguredWidthCount = useRef(configuredWidthCount);
  const widthConfigResetKey = configuredWidthCount < prevConfiguredWidthCount.current ? Symbol() : undefined;
  const resetColumnWidths = widthConfigResetKey != null ? new Map() : undefined;

  prevConfiguredWidthCount.current = configuredWidthCount;

  const [widths, numFrozenColsFullyInView] = useColWidths(
    displayedFields,
    availableWidth,
    frozenColumns,
    widthConfigResetKey
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
    () => getDefaultRowHeight(theme, displayedFields, cellHeight),
    [theme, displayedFields, cellHeight]
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
      enableColumnReorder: true,
      showTypeIcons,
      timeRange,
      onHideColumn: handleHideColumn,
      onGroupByColumn,
      onTogglePin: handleTogglePin,
      pinnedColumns: pinnedColumnSet,
      settlingColumnKeys,
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
      onGroupByColumn,
      frozenColumns,
      numFrozenColsFullyInView,
      maxRowHeight,
      disableKeyboardEvents,
      disableSanitizeHtml,
      handleHideColumn,
      handleTogglePin,
      pinnedColumnSet,
      setFilter,
      settlingColumnKeys,
      showTypeIcons,
      timeRange,
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

  const dataGrid = (
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
      onColumnsReorder={handleColumnsReorder}
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

  if (!hasHeader) {
    return dataGrid;
  }

  return (
    <div {...containerProps} className={clsx(containerProps.className, splitterStyles.container)}>
      <div
        {...primaryProps}
        style={{
          ...primaryProps.style,
          minWidth: isColumnVisibilityPanelOpen ? COLUMN_VISIBILITY_PANEL_MIN_WIDTH : 0,
          maxWidth: columnVisibilityPanelMaxWidth,
        }}
      >
        <ColumnVisibilitySidePanel
          fields={pinnedOrderedVisibleFields}
          hiddenColumns={hiddenColumns}
          pinnedColumns={pinnedColumnSet}
          isOpen={isColumnVisibilityPanelOpen}
          onToggleColumn={handleToggleColumnVisibility}
          onTogglePin={handleTogglePin}
          onColumnsReorder={handleColumnsReorder}
        />
      </div>
      {/* useSplitter supplies the separator role, keyboard behavior, and tab stop through splitterProps. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        {...splitterProps}
        className={clsx(splitterProps.className, splitterStyles.handle)}
        aria-label={t('grafana-ui.table.column-visibility-resizer', 'Column visibility panel')}
        title={t(
          'grafana-ui.table.column-visibility-resizer-instructions',
          'Click to open or close. Drag or use arrow keys to resize.'
        )}
        onDoubleClick={undefined}
        onPointerDown={(event) => {
          splitterPointerState.current = { startX: event.clientX, moved: false };
          splitterHookActive.current = typeof event.currentTarget.setPointerCapture === 'function';
          if (splitterHookActive.current) {
            splitterProps.onPointerDown(event);
          }
        }}
        onPointerMove={(event) => {
          if (Math.abs(event.clientX - splitterPointerState.current.startX) > SPLITTER_DRAG_THRESHOLD) {
            splitterPointerState.current.moved = true;
          }
          if (splitterHookActive.current) {
            splitterProps.onPointerMove(event);
          }
        }}
        onPointerUp={(event) => {
          const shouldTogglePanel = !splitterPointerState.current.moved;
          if (splitterHookActive.current) {
            splitterProps.onPointerUp(event);
            splitterHookActive.current = false;
          }
          if (shouldTogglePanel) {
            setIsColumnVisibilityPanelOpen((open) => !open);
          }
        }}
        onPointerCancel={() => {
          splitterHookActive.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsColumnVisibilityPanelOpen((open) => !open);
            return;
          }
          splitterProps.onKeyDown(event);
        }}
      />
      <div {...secondaryProps} style={{ ...secondaryProps.style, minWidth: 0 }}>
        {dataGrid}
      </div>
    </div>
  );
}

const getColumnVisibilitySplitterStyles = memoize((theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
    minWidth: 0,
    minHeight: 0,
  }),
  handle: css({
    zIndex: theme.zIndex.tooltip,
    '&::after': {
      width: `${COLUMN_VISIBILITY_RAIL_WIDTH}px !important`,
      height: '128px !important',
      background: '#f59e4b !important',
    },
  }),
}));
