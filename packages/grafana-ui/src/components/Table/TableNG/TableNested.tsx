import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { type DataFrame, type Field, FieldType } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Cell,
  DataGrid,
  type DataGridHandle,
  type DataGridProps,
  type Renderers,
  type SortColumn,
} from '@grafana/react-data-grid';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { getTextColorForBackground as _getTextColorForBackground } from '../../../utils/colors';
import { usePanelContext } from '../../PanelChrome';
import { type DataLinksActionsTooltipState } from '../utils';

import { TableDataGrid } from './TableDataGrid';
import { EmptyTablePlaceholder } from './components/EmptyTablePlaceholder';
import { RowExpander } from './components/RowExpander';
import { COLUMN, TABLE } from './constants';
import {
  useColumnResize,
  useColWidths,
  useFilteredRows,
  useHeaderHeight,
  useManagedSort,
  useNestedColWidths,
  useNestedRows,
  usePaginatedRows,
  useRowHeight,
  useScrollbarWidth,
  useSortedRows,
} from './hooks';
import { type ColumnBuildConfig, useColumnBuilderFromFields, useDataGridRows } from './render-hooks';
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
  getDisplayName,
  getStableRowKey,
  getVisibleFields,
} from './utils';

const EXPANDED_COLUMN_KEY = 'expanded';
type OnCellClick = NonNullable<DataGridProps<TableRow, TableSummaryRow>['onCellClick']>;

export function TableNested(props: TableNGProps & { nestedFramesField: Field<DataFrame[]> }) {
  const {
    cellHeight,
    data,
    disableKeyboardEvents,
    disableSanitizeHtml,
    enablePagination = false,
    enableSharedCrosshair = false,
    enableVirtualization,
    getActions = () => [],
    height,
    maxRowHeight: _maxRowHeight,
    nestedFramesField,
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

  const uniqueId = useId();
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
  const nestedResizeHandler = useColumnResize(onColumnResize, 'nested');

  const nestedFramesFieldName = useMemo(() => getDisplayName(nestedFramesField), [nestedFramesField]);
  const nestedData: DataFrame[] = useMemo(() => nestedFramesField.values.map((v) => v[0]), [nestedFramesField]);

  const frameToRecords = useMemo(
    () => compileFrameToRecords(data, nestedFramesFieldName),
    [data, nestedFramesFieldName]
  );
  const rows = useMemo(() => frameToRecords(data), [frameToRecords, data]);

  const getRowStableKeyForRowIdx = useCallback(
    (rowIdx: number): string => getStableRowKey(rowIdx, nestedData[rowIdx]),
    [nestedData]
  );

  const firstRowNestedData = nestedData[0];
  const nestedFields = firstRowNestedData.fields;
  const nestedVisibleFields = useMemo(() => getVisibleFields(nestedFields), [nestedFields]);
  const nestedHasFooter = useMemo(
    () => nestedVisibleFields.some((field) => Boolean(field.config.custom?.footer?.reducers?.length)),
    [nestedVisibleFields]
  );
  const nestedFooterHeight = useMemo(
    () => (nestedHasFooter ? calculateFooterHeight(nestedVisibleFields) : 0),
    [nestedHasFooter, nestedVisibleFields]
  );

  const { rows: filteredRows, filter, setFilter, filterResult } = useFilteredRows(rows, data.fields, true);

  const {
    rows: sortedRows,
    sortColumns,
    setSortColumns,
  } = useSortedRows(filteredRows, data.fields, nestedFields, { hasNestedFrames: true, initialSortBy: sortBy });

  useManagedSort({ sortByBehavior, setSortColumns, sortBy });

  const nestedRows = useNestedRows(rows, nestedData, true, nestedFramesFieldName, filter, sortColumns);

  const [inspectCell, setInspectCell] = useState<InspectCellProps | null>(null);
  const [tooltipState, setTooltipState] = useState<DataLinksActionsTooltipState>();
  const onCellClick: OnCellClick = useCallback(
    ({ column, row }, ev) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const field = (column as unknown as TableColumn).field;

      if (column.key === EXPANDED_COLUMN_KEY) {
        return;
      }

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

  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => {
    if (data.meta?.custom?.expandAllRows) {
      const nestedField = data.fields.find((f) => f.type === FieldType.nestedFrames);
      return new Set(Array.from({ length: data.length }, (_, i) => getStableRowKey(i, nestedField?.values?.[i]?.[0])));
    }
    return new Set();
  });

  const gridRef = useRef<DataGridHandle>(null);
  const scrollbarWidth = useScrollbarWidth(gridRef, height);
  // nested tables don't support frozen columns; subtract expander column width
  const frozenColumns = 0;
  const numFrozenColsFullyInView = 0;
  const availableWidth = useMemo(() => width - COLUMN.EXPANDER_WIDTH - scrollbarWidth, [width, scrollbarWidth]);

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

  const [widths] = useColWidths(visibleFields, availableWidth, frozenColumns);

  const headerHeight = useHeaderHeight({
    columnWidths: widths,
    fields: visibleFields,
    enabled: hasHeader,
    sortColumns,
    showTypeIcons: showTypeIcons ?? false,
    typographyCtx,
  });
  const maxRowHeight = _maxRowHeight != null ? Math.max(TABLE.LINE_HEIGHT, _maxRowHeight) : undefined;
  const visibleNestedRowCounts = useMemo(
    () => nestedRows.map((row, idx) => (expandedRows.has(getRowStableKeyForRowIdx(idx)) ? row.final.length : null)),
    [nestedRows, expandedRows, getRowStableKeyForRowIdx]
  );

  const { nestedFieldWidths, nestedColWidths, handleNestedColumnWidthsChange } = useNestedColWidths({
    nestedVisibleFields,
    availableWidth,
    structureRev,
  });

  const hasNestedHeaders = useMemo(() => firstRowNestedData.meta?.custom?.noHeader !== true, [firstRowNestedData]);
  const nestedHeaderHeight = useHeaderHeight({
    columnWidths: nestedFieldWidths,
    fields: nestedVisibleFields,
    enabled: hasNestedHeaders,
    sortColumns,
    showTypeIcons: showTypeIcons ?? false,
    typographyCtx,
  });

  const defaultRowHeight = useMemo(
    () => getDefaultRowHeight(theme, visibleFields, cellHeight),
    [theme, visibleFields, cellHeight]
  );
  const defaultNestedRowHeight = useMemo(
    () => getDefaultRowHeight(theme, nestedVisibleFields, cellHeight),
    [theme, nestedVisibleFields, cellHeight]
  );

  const rowHeight = useRowHeight({
    columnWidths: widths,
    fields: visibleFields,
    hasNestedFrames: true,
    defaultHeight: defaultRowHeight,
    defaultNestedHeight: defaultNestedRowHeight,
    visibleNestedRowCounts,
    typographyCtx,
    maxHeight: maxRowHeight,
    nestedColWidths: nestedFieldWidths,
    nestedFields: nestedVisibleFields,
    nestedRows,
    nestedFooterHeight,
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
    hasNestedFrames: true,
  });

  const showPagination = enablePagination && numRows > 0;
  const styles = useStyles2(getGridStyles, showPagination, transparent);

  const rowHeightFn = useMemo((): ((row: TableRow) => number) => {
    if (typeof defaultNestedRowHeight === 'string') {
      return (row: TableRow) => (expandedRows.has(getRowStableKeyForRowIdx(row.__index)) ? TABLE.MAX_CELL_HEIGHT : 0);
    }
    if (typeof rowHeight === 'function') {
      // safe: we only return a (row: TableRow) => string function when defaultNestedRowHeight is a string.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return rowHeight as unknown as (row: TableRow) => number;
    }
    if (typeof rowHeight === 'string') {
      return () => TABLE.MAX_CELL_HEIGHT;
    }
    return () => rowHeight;
  }, [rowHeight, defaultNestedRowHeight, expandedRows, getRowStableKeyForRowIdx]);

  const renderRow = useDataGridRows(
    data.fields,
    panelContext,
    expandedRows,
    enableSharedCrosshair,
    getRowStableKeyForRowIdx
  );

  const renderRowNested = useDataGridRows(
    nestedFields,
    panelContext,
    expandedRows,
    enableSharedCrosshair,
    getRowStableKeyForRowIdx
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
        headerRowHeight: noHeader ? 0 : headerHeight,
      }) satisfies Partial<DataGridProps<TableRow, TableSummaryRow>>,
    [
      enableVirtualization,
      hasFooter,
      sortColumns,
      rowHeight,
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
      applyToRowBgFn,
      disableKeyboardEvents,
      disableSanitizeHtml,
      filter,
      getCellActions,
      getCellColorInlineStyles,
      getTextColorForBackground,
      maxRowHeight,
      onCellFilterAdded,
      rowHeight,
      rowHeightFn,
      setFilter,
      showTypeIcons,
      theme,
      timeRange,
    ]
  );

  const fromFields = useColumnBuilderFromFields(filterResult, columnBuildConfig, nestedRows);

  const buildNestedTableExpanderColumn = useCallback(
    (
      nestedColumnsMatrix: FromFieldsResult[],
      hasNestedHeaders: boolean,
      nestedHeaderHeightPx: number,
      hasNestedFooter: boolean,
      nestedFooterHeightPx: number,
      renderers: Renderers<TableRow, TableSummaryRow>
    ): TableColumn => ({
      key: EXPANDED_COLUMN_KEY,
      sortable: false,
      resizable: false,
      name: t('grafana-ui.table.nested-table.expander-column-name', 'Expand nested rows'),
      field: {
        name: '',
        type: FieldType.other,
        config: {},
        values: [],
      },
      cellClass(row) {
        if (row.__depth !== 0) {
          return styles.cellNested;
        }
        return;
      },
      colSpan(args) {
        return args.type === 'ROW' && args.row.__depth === 1 ? data.fields.length : 1;
      },
      renderCell: ({ row }) => {
        const rowId = `${uniqueId}-nested-table-${row.__index}`;

        if (row.__depth === 0) {
          const rowIdx = row.__index;
          const stableKey = getRowStableKeyForRowIdx(rowIdx);

          return (
            <RowExpander
              rowId={rowId}
              isExpanded={expandedRows.has(stableKey)}
              onCellExpand={() => {
                setExpandedRows((er) => {
                  if (er.has(stableKey)) {
                    er.delete(stableKey);
                  } else {
                    er.add(stableKey);
                  }
                  return new Set(er);
                });
              }}
            />
          );
        }

        const expandedRecords = nestedRows[row.__index]?.final ?? [];
        if (!expandedRecords.length) {
          return (
            <div className={styles.noDataNested}>
              <Trans i18nKey="grafana-ui.table.nested-table.no-data">No data</Trans>
            </div>
          );
        }

        const nestedColumns = nestedColumnsMatrix[row.__index].columns;

        return (
          <div id={rowId}>
            <DataGrid<TableRow, TableSummaryRow>
              {...commonDataGridProps}
              className={clsx(styles.grid, styles.gridNested)}
              headerRowClass={clsx(styles.headerRow, hasNestedHeaders ? '' : styles.displayNone)}
              headerRowHeight={hasNestedHeaders ? nestedHeaderHeightPx : 0}
              bottomSummaryRows={hasNestedFooter ? [{}] : undefined}
              summaryRowHeight={nestedFooterHeightPx}
              onColumnResize={nestedResizeHandler}
              columns={nestedColumns}
              rows={expandedRecords}
              renderers={{ ...renderers, noRowsFallback: <EmptyTablePlaceholder noValue={noValue} /> }}
              onCellClick={onCellClick}
              columnWidths={nestedColWidths}
              onColumnWidthsChange={handleNestedColumnWidthsChange}
            />
          </div>
        );
      },
      renderHeaderCell(props) {
        return <div className="sr-only">{props.column.name}</div>;
      },
      width: COLUMN.EXPANDER_WIDTH,
      minWidth: COLUMN.EXPANDER_WIDTH,
    }),
    [
      styles.cellNested,
      styles.grid,
      styles.gridNested,
      styles.headerRow,
      styles.displayNone,
      styles.noDataNested,
      data.fields.length,
      commonDataGridProps,
      expandedRows,
      getRowStableKeyForRowIdx,
      nestedRows,
      noValue,
      onCellClick,
      uniqueId,
      nestedColWidths,
      nestedResizeHandler,
      handleNestedColumnWidthsChange,
    ]
  );

  const nestedColumnsMatrix = useMemo(() => {
    const result: FromFieldsResult[] = Array.from({ length: nestedData.length });
    for (const row of rows) {
      if (row.__depth > 0) {
        const rowNestedFrame = nestedData[row.__index]!;
        result[row.__index] = fromFields(
          getVisibleFields(rowNestedFrame.fields),
          nestedFieldWidths,
          rowNestedFrame,
          nestedRows[row.__index].raw,
          nestedRows[row.__index].final
        );
      }
    }
    return result;
  }, [rows, nestedData, nestedRows, nestedFieldWidths, fromFields]);

  const { columns, cellRootRenderers } = useMemo(() => {
    const result = fromFields(visibleFields, widths, data, rows, sortedRows);

    if (!firstRowNestedData) {
      return result;
    }

    const expanderCellRenderer: CellRootRenderer = (key, cellProps) => <Cell key={key} {...cellProps} />;
    result.cellRootRenderers[EXPANDED_COLUMN_KEY] = expanderCellRenderer;

    result.columns.unshift(
      buildNestedTableExpanderColumn(
        nestedColumnsMatrix,
        hasNestedHeaders,
        nestedHeaderHeight,
        nestedHasFooter,
        nestedFooterHeight,
        {
          renderRow: renderRowNested,
          renderCell: (key, cellProps) =>
            nestedColumnsMatrix[cellProps.row.__parentIndex!].cellRootRenderers[cellProps.column.key](key, cellProps),
        }
      )
    );

    return result;
  }, [
    buildNestedTableExpanderColumn,
    data,
    firstRowNestedData,
    fromFields,
    hasNestedHeaders,
    nestedColumnsMatrix,
    nestedFooterHeight,
    nestedHasFooter,
    nestedHeaderHeight,
    renderRowNested,
    rows,
    sortedRows,
    visibleFields,
    widths,
  ]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const structureRevColumns = useMemo(() => columns, [columns, structureRev]);
  const renderCellRoot: CellRootRenderer = useCallback(
    (key, cellProps) => cellRootRenderers[cellProps.column.key](key, cellProps),
    [cellRootRenderers]
  );

  return (
    <TableDataGrid
      role="treegrid"
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
        if (disableKeyboardEvents || event.isDefaultPrevented()) {
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
