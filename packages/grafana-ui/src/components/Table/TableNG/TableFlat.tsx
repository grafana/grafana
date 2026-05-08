import memoize from 'micro-memoize';
import { useCallback, useMemo, useRef, useState } from 'react';
import { type DataGridHandle, type DataGridProps } from 'react-data-grid';

import { type Field } from '@grafana/data';

import { useTheme2 } from '../../../themes/ThemeContext';
import { getTextColorForBackground as _getTextColorForBackground } from '../../../utils/colors';
import { usePanelContext } from '../../PanelChrome';
import { type DataLinksActionsTooltipState } from '../utils';

import { TableDataGrid } from './TableDataGrid';
import { buildColumnsFromFields, type ColumnBuildConfig } from './columnBuilder';
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
} from './hooks';
import { renderRowFactory } from './rowBuilder';
import {
  type CellRootRenderer,
  type FromFieldsResult,
  type InspectCellProps,
  type TableColumn,
  type TableNGProps,
  type TableRow,
  type TableSummaryRow,
} from './types';
import {
  calculateFooterHeight,
  compileFrameToRecords,
  createTypographyContext,
  extractPixelValue,
  getApplyToRowBgFn,
  getCellColorInlineStylesFactory,
  getCellLinks,
  getDefaultRowHeight,
  getVisibleFields,
} from './utils';

type OnCellClick = NonNullable<DataGridProps<TableRow, TableSummaryRow>['onCellClick']>;

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

  const frameToRecords = useMemo(() => compileFrameToRecords(data, undefined), [data]);
  const rows = useMemo(() => frameToRecords(data), [frameToRecords, data]);

  const { rows: filteredRows, filter, setFilter, filterResult } = useFilteredRows(rows, data.fields);
  const {
    rows: sortedRows,
    sortColumns,
    setSortColumns,
  } = useSortedRows(filteredRows, data.fields, [], { initialSortBy: sortBy });

  useManagedSort({ sortByBehavior, setSortColumns, sortBy });

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

  const frozenColumns = _frozenColumns;
  const [widths, numFrozenColsFullyInView] = useColWidths(visibleFields, availableWidth, frozenColumns);

  const headerHeight = useHeaderHeight({
    columnWidths: widths,
    fields: visibleFields,
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
    fields: visibleFields,
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

  // Flat tables have no depth-1 rows, so the expandedRows Set is never consulted.
  const renderRow = useMemo(
    () => renderRowFactory(data.fields, panelContext, new Set(), enableSharedCrosshair, () => ''),
    [data.fields, panelContext, enableSharedCrosshair]
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
    ]
  );

  const fromFields = useCallback(
    (
      f: Field[],
      colWidths: number[],
      frame: typeof data,
      rawRows: TableRow[],
      visibleRows: TableRow[]
    ): FromFieldsResult =>
      buildColumnsFromFields(f, colWidths, frame, rawRows, visibleRows, filterResult, columnBuildConfig),
    [filterResult, columnBuildConfig]
  );

  const { columns, cellRootRenderers } = useMemo(
    () => fromFields(visibleFields, widths, data, rows, sortedRows),
    [fromFields, visibleFields, widths, data, rows, sortedRows]
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
      onColumnResize={resizeHandler}
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
}
