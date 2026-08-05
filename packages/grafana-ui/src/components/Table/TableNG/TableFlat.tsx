import memoize from 'micro-memoize';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type Field } from '@grafana/data';
import { type DataGridHandle, type DataGridProps } from '@grafana/react-data-grid';

import { useTheme2 } from '../../../themes/ThemeContext';
import { getTextColorForBackground as _getTextColorForBackground } from '../../../utils/colors';
import { usePanelContext } from '../../PanelChrome';
import { type DataLinksActionsTooltipState } from '../cellUtils';

import { TableDataGrid } from './TableDataGrid';
import { ColumnFreezeDivider } from './components/ColumnFreezeDivider';
import { ColumnVisibilityPicker } from './components/ColumnVisibilityPicker';
import { type PinningInteraction, PinningPrototypeControls } from './components/PinningPrototypeControls';
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
  updatePinnedColumnsAfterReorder,
} from './utils';

type OnCellClick = NonNullable<DataGridProps<TableRow, TableSummaryRow>['onCellClick']>;

// Flat tables have no depth-1 rows, so expandedRows is never consulted.
// Stable references avoid invalidating useDataGridRows' memo on every render.
const EMPTY_EXPANDED_ROWS: Set<string> = new Set();
const NOOP_STABLE_KEY = () => '';
const COLUMN_SETTLE_MS = 280;

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
  const [pinningInteraction, setPinningInteraction] = useState<PinningInteraction>('both');
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

  const handleTogglePin = useCallback(
    (displayName: string) => {
      setPinnedColumns((current) => {
        const effective = current ?? configuredPinnedColumns;
        return effective.includes(displayName)
          ? effective.filter((column) => column !== displayName)
          : [...effective, displayName];
      });
    },
    [configuredPinnedColumns]
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

      if (pinningInteraction !== 'menu') {
        const nextPinnedColumns = updatePinnedColumnsAfterReorder(
          effectivePinnedColumns,
          sourceColumnKey,
          targetColumnKey
        );
        if (nextPinnedColumns !== effectivePinnedColumns) {
          setPinnedColumns(nextPinnedColumns);
        }
      }

      setSettlingColumnKeys(new Set([sourceColumnKey, targetColumnKey]));
      if (settleTimeoutRef.current) {
        window.clearTimeout(settleTimeoutRef.current);
      }
      settleTimeoutRef.current = window.setTimeout(() => {
        setSettlingColumnKeys(new Set());
        settleTimeoutRef.current = undefined;
      }, COLUMN_SETTLE_MS);
    },
    [effectivePinnedColumns, pinningInteraction, visibleFields]
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
  // `width` may already be debounced by RefactoredTableNG. scrollbarWidth never is, so a scrollbar
  // appearing/disappearing re-sizes columns immediately instead of lagging behind that debounce.
  const availableWidth = useMemo(() => width - scrollbarWidth, [width, scrollbarWidth]);

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
  const renderedPinnedColumnCount = Math.max(0, Math.min(frozenColumns, numFrozenColsFullyInView));
  const pinnedWidth = widths.slice(0, renderedPinnedColumnCount).reduce((total, columnWidth) => total + columnWidth, 0);
  const handlePinnedColumnCountChange = useCallback(
    (count: number) => {
      const visiblePinnedColumns = displayedFields.slice(0, count).map(getDisplayName);
      const hiddenPinnedColumns = effectivePinnedColumns.filter((column) => hiddenColumns.has(column));
      setPinnedColumns([...visiblePinnedColumns, ...hiddenPinnedColumns]);
    },
    [displayedFields, effectivePinnedColumns, hiddenColumns]
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
    height: height - (noHeader ? 0 : TABLE.INTERACTION_TOOLBAR_HEIGHT),
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
      onTogglePin: pinningInteraction !== 'divider' ? handleTogglePin : undefined,
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
      pinningInteraction,
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
      toolbar={
        !noHeader ? (
          <>
            <PinningPrototypeControls value={pinningInteraction} onChange={setPinningInteraction} />
            <ColumnVisibilityPicker
              fields={pinnedOrderedVisibleFields}
              hiddenColumns={hiddenColumns}
              onToggleColumn={handleToggleColumnVisibility}
            />
          </>
        ) : undefined
      }
      renderGridOverlay={
        !noHeader && pinningInteraction !== 'menu'
          ? (gridContainerRef) => (
              <ColumnFreezeDivider
                gridRef={gridContainerRef}
                columnCount={displayedFields.length}
                pinnedColumnCount={renderedPinnedColumnCount}
                pinnedWidth={pinnedWidth}
                onPinnedColumnCountChange={handlePinnedColumnCountChange}
              />
            )
          : undefined
      }
    />
  );
}
