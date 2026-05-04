import 'react-data-grid/lib/styles.css';

import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DataGrid,
  type DataGridHandle,
  type DataGridProps,
  type SortColumn,
} from 'react-data-grid';

import { type Field } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { getTextColorForBackground as _getTextColorForBackground } from '../../../utils/colors';
import { Pagination } from '../../Pagination/Pagination';
import { usePanelContext } from '../../PanelChrome';
import { DataLinksActionsTooltip } from '../DataLinksActionsTooltip';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { type DataLinksActionsTooltipState } from '../utils';

import { buildColumnsFromFields, type ColumnBuildConfig } from './columnBuilder';
import { EmptyTablePlaceholder } from './components/EmptyTablePlaceholder';
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
import { getGridStyles, IS_SAFARI_26 } from './styles';
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
  renderRowFactory,
  rowKeyGetter,
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

      if (
        ev.target instanceof HTMLElement &&
        ev.target.closest('a[aria-haspopup], .rdg-cell')?.matches('a')
      ) {
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

  const [selectedRows, setSelectedRows] = useState((): ReadonlySet<string> => new Set());

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

  const showPagination = enablePagination && numRows > 0;
  const styles = useStyles2(getGridStyles, showPagination, transparent);

  const [scrollToIndex, setScrollToIndex] = useState(initialRowIndex);
  useEffect(() => {
    if (scrollToIndex !== undefined && sortedRows && gridRef.current?.scrollToCell) {
      const rowIdx = sortedRows.findIndex((row) => row.__index === scrollToIndex);
      gridRef.current.scrollToCell({ rowIdx });
      setScrollToIndex(undefined);
      setSelectedRows(new Set<string>([rowKeyGetter(sortedRows[rowIdx])]));
    }
  }, [scrollToIndex, sortedRows]);

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

  const commonDataGridProps = useMemo(
    () =>
      ({
        enableVirtualization: !IS_SAFARI_26 && enableVirtualization !== false && typeof rowHeight !== 'string',
        defaultColumnOptions: {
          minWidth: 50,
          resizable: true,
          sortable: true,
        },
        onSortColumnsChange: (newSortColumns: SortColumn[]) => {
          setSortColumns(newSortColumns);
          onSortByChange?.(
            newSortColumns.map(({ columnKey, direction }) => ({
              displayName: columnKey,
              desc: direction === 'DESC',
            }))
          );
        },
        sortColumns,
        rowHeight,
        bottomSummaryRows: hasFooter ? [{}] : undefined,
        summaryRowHeight: footerHeight,
        headerRowClass: styles.headerRow,
        headerRowHeight: noHeader ? 0 : headerHeight,
      }) satisfies Partial<DataGridProps<TableRow, TableSummaryRow>>,
    [
      enableVirtualization,
      hasFooter,
      sortColumns,
      rowHeight,
      styles.headerRow,
      noHeader,
      setSortColumns,
      onSortByChange,
      footerHeight,
      headerHeight,
    ]
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

  const itemsRangeStart = pageRangeStart;
  const displayedEnd = pageRangeEnd;

  return (
    <>
      <DataGrid<TableRow, TableSummaryRow, string>
        {...commonDataGridProps}
        role="grid"
        ref={gridRef}
        className={styles.grid}
        columns={structureRevColumns}
        rows={paginatedRows}
        rowKeyGetter={rowKeyGetter}
        isRowSelectionDisabled={() => initialRowIndex !== undefined}
        selectedRows={selectedRows}
        onSelectedRowsChange={setSelectedRows}
        headerRowClass={clsx(styles.headerRow, noHeader ? styles.displayNone : '')}
        headerRowHeight={headerHeight}
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
        renderers={{
          renderRow,
          renderCell: renderCellRoot,
          noRowsFallback: <EmptyTablePlaceholder noValue={noValue} />,
        }}
      />

      {enablePagination && numRows > 0 && (
        <div className={styles.paginationContainer}>
          <Pagination
            className="table-ng-pagination"
            currentPage={page + 1}
            numberOfPages={numPages}
            showSmallVersion={smallPagination}
            onNavigate={(toPage) => {
              setPage(toPage - 1);
            }}
          />
          {!smallPagination && (
            <div className={styles.paginationSummary}>
              <Trans i18nKey="grafana-ui.table.pagination-summary">
                {{ itemsRangeStart }} - {{ displayedEnd }} of {{ numRows }} rows
              </Trans>
            </div>
          )}
        </div>
      )}

      {tooltipState && (
        <DataLinksActionsTooltip
          links={tooltipState.links ?? []}
          actions={tooltipState.actions}
          coords={tooltipState.coords}
          onTooltipClose={() => setTooltipState(undefined)}
        />
      )}

      {inspectCell && (
        <TableCellInspector
          mode={inspectCell.mode ?? TableCellInspectorMode.text}
          value={inspectCell.value}
          onDismiss={() => setInspectCell(null)}
        />
      )}
    </>
  );
}
