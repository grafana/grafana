import 'react-data-grid/lib/styles.css';

import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import { CSSProperties, Key, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import {
  Cell,
  CellRendererProps,
  DataGrid,
  DataGridHandle,
  DataGridProps,
  RenderCellProps,
  Renderers,
  RenderRowProps,
  Row,
  SortColumn,
} from 'react-data-grid';

import {
  DataHoverClearEvent,
  DataHoverEvent,
  FALLBACK_COLOR,
  Field,
  FieldType,
  getDisplayProcessor,
  ReducerID,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { FieldColorModeId, TableCellTooltipPlacement } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { getTextColorForBackground as _getTextColorForBackground } from '../../../utils/colors';
import { Pagination } from '../../Pagination/Pagination';
import { PanelContext, usePanelContext } from '../../PanelChrome';
import { DataLinksActionsTooltip } from '../DataLinksActionsTooltip';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { TableCellDisplayMode } from '../types';
import { DataLinksActionsTooltipState } from '../utils';

import { getCellRenderer, getCellSpecificStyles } from './Cells/renderers';
import { HeaderCell } from './components/HeaderCell';
import { RowExpander } from './components/RowExpander';
import { TableCellActions } from './components/TableCellActions';
import { TableCellTooltip } from './components/TableCellTooltip';
import { COLUMN, TABLE } from './constants';
import {
  useColumnResize,
  useColWidths,
  useFilteredRows,
  useFooterCalcs,
  useHeaderHeight,
  usePaginatedRows,
  useRowHeight,
  useScrollbarWidth,
  useSortedRows,
} from './hooks';
import {
  getCellActionStyles,
  getDefaultCellStyles,
  getFooterStyles,
  getGridStyles,
  getHeaderCellStyles,
  getLinkStyles,
  getMaxHeightCellStyles,
  getTooltipStyles,
} from './styles';
import {
  TableNGProps,
  TableRow,
  TableSummaryRow,
  TableColumn,
  InspectCellProps,
  TableCellStyleOptions,
  FromFieldsResult,
  CellRootRenderer,
} from './types';
import {
  applySort,
  canFieldBeColorized,
  createTypographyContext,
  displayJsonValue,
  extractPixelValue,
  frameToRecords,
  getAlignment,
  getApplyToRowBgFn,
  getCellColorInlineStylesFactory,
  getCellLinks,
  getCellOptions,
  getDefaultRowHeight,
  getDisplayName,
  getIsNestedTable,
  getJustifyContent,
  getVisibleFields,
  isCellInspectEnabled,
  predicateByName,
  shouldTextOverflow,
  shouldTextWrap,
  withDataLinksActionsTooltip,
} from './utils';

const EXPANDED_COLUMN_KEY = 'expanded';

export function TableNG(props: TableNGProps) {
  const {
    cellHeight,
    data,
    disableSanitizeHtml,
    enablePagination = false,
    enableSharedCrosshair = false,
    enableVirtualization,
    footerOptions,
    frozenColumns = 0,
    getActions = () => [],
    height,
    initialSortBy,
    maxRowHeight: _maxRowHeight,
    noHeader,
    onCellFilterAdded,
    onColumnResize,
    onSortByChange,
    showTypeIcons,
    structureRev,
    timeRange,
    transparent,
    width,
  } = props;

  const theme = useTheme2();
  const styles = useStyles2(getGridStyles, enablePagination, transparent);
  const panelContext = usePanelContext();

  const getCellActions = useCallback(
    (field: Field, rowIdx: number) => getActions(data, field, rowIdx),
    [getActions, data]
  );

  const hasHeader = !noHeader;
  const hasFooter = Boolean(footerOptions?.show && footerOptions.reducer?.length);
  const isCountRowsSet = Boolean(
    footerOptions?.countRows &&
      footerOptions.reducer &&
      footerOptions.reducer.length &&
      footerOptions.reducer[0] === ReducerID.count
  );

  const resizeHandler = useColumnResize(onColumnResize);

  const rows = useMemo(() => frameToRecords(data), [data]);
  const hasNestedFrames = useMemo(() => getIsNestedTable(data.fields), [data]);
  const getTextColorForBackground = useMemo(() => memoize(_getTextColorForBackground, { maxSize: 1000 }), []);

  const {
    rows: filteredRows,
    filter,
    setFilter,
    crossFilterOrder,
    crossFilterRows,
  } = useFilteredRows(rows, data.fields, { hasNestedFrames });

  const {
    rows: sortedRows,
    sortColumns,
    setSortColumns,
  } = useSortedRows(filteredRows, data.fields, { hasNestedFrames, initialSortBy });

  const [inspectCell, setInspectCell] = useState<InspectCellProps | null>(null);
  const [tooltipState, setTooltipState] = useState<DataLinksActionsTooltipState>();
  const [expandedRows, setExpandedRows] = useState(() => new Set<number>());

  // vt scrollbar accounting for column auto-sizing
  const visibleFields = useMemo(() => getVisibleFields(data.fields), [data.fields]);
  const defaultRowHeight = useMemo(
    () => getDefaultRowHeight(theme, visibleFields, cellHeight),
    [theme, visibleFields, cellHeight]
  );
  const gridRef = useRef<DataGridHandle>(null);
  const scrollbarWidth = useScrollbarWidth(gridRef, height);
  const availableWidth = useMemo(
    () => (hasNestedFrames ? width - COLUMN.EXPANDER_WIDTH : width) - scrollbarWidth,
    [width, hasNestedFrames, scrollbarWidth]
  );
  const getCellColorInlineStyles = useMemo(() => getCellColorInlineStylesFactory(theme), [theme]);
  const applyToRowBgFn = useMemo(
    () => getApplyToRowBgFn(data.fields, getCellColorInlineStyles) ?? undefined,
    [data.fields, getCellColorInlineStyles]
  );
  const typographyCtx = useMemo(
    () =>
      createTypographyContext(
        theme.typography.fontSize,
        theme.typography.fontFamily,
        extractPixelValue(theme.typography.body.letterSpacing!) * theme.typography.fontSize
      ),
    [theme]
  );

  const [widths, numFrozenColsFullyInView] = useColWidths(visibleFields, availableWidth, frozenColumns);

  const headerHeight = useHeaderHeight({
    columnWidths: widths,
    fields: visibleFields,
    enabled: hasHeader,
    sortColumns,
    showTypeIcons: showTypeIcons ?? false,
    typographyCtx,
  });
  // the minimum max row height we should honor is a single line of text.
  const maxRowHeight = _maxRowHeight != null ? Math.max(TABLE.LINE_HEIGHT, _maxRowHeight) : undefined;
  const rowHeight = useRowHeight({
    columnWidths: widths,
    fields: visibleFields,
    hasNestedFrames,
    defaultHeight: defaultRowHeight,
    expandedRows,
    typographyCtx,
    maxHeight: maxRowHeight,
  });

  const {
    rows: paginatedRows,
    page,
    setPage,
    numPages,
    pageRangeStart,
    pageRangeEnd,
    smallPagination,
  } = usePaginatedRows(sortedRows, {
    enabled: enablePagination,
    width: availableWidth,
    height,
    headerHeight,
    footerHeight: hasFooter ? (typeof defaultRowHeight === 'number' ? defaultRowHeight : TABLE.MAX_CELL_HEIGHT) : 0,
    rowHeight,
  });

  // Create a map of column key to text wrap
  const footerCalcs = useFooterCalcs(sortedRows, visibleFields, {
    enabled: hasFooter,
    footerOptions,
    isCountRowsSet,
  });

  // normalize the row height into a function which returns a number, so we avoid a bunch of conditionals during rendering.
  const rowHeightFn = useMemo((): ((row: TableRow) => number) => {
    if (typeof rowHeight === 'function') {
      return rowHeight;
    }
    if (typeof rowHeight === 'string') {
      return () => TABLE.MAX_CELL_HEIGHT;
    }
    return () => rowHeight;
  }, [rowHeight]);

  const renderRow = useMemo(
    () => renderRowFactory(data.fields, panelContext, expandedRows, enableSharedCrosshair),
    [data, enableSharedCrosshair, expandedRows, panelContext]
  );

  const commonDataGridProps = useMemo(
    () =>
      ({
        enableVirtualization: enableVirtualization !== false && rowHeight !== 'auto',
        defaultColumnOptions: {
          minWidth: 50,
          resizable: true,
          sortable: true,
          // draggable: true,
        },
        onColumnResize: resizeHandler,
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
      }) satisfies Partial<DataGridProps<TableRow, TableSummaryRow>>,
    [enableVirtualization, resizeHandler, sortColumns, rowHeight, hasFooter, setSortColumns, onSortByChange]
  );

  const buildNestedTableExpanderColumn = useCallback(
    (
      nestedColumns: TableColumn[],
      hasNestedHeaders: boolean,
      renderers: Renderers<TableRow, TableSummaryRow>
    ): TableColumn => ({
      key: EXPANDED_COLUMN_KEY,
      name: '',
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
        if (row.__depth === 0) {
          const rowIdx = row.__index;

          return (
            <RowExpander
              isExpanded={expandedRows.has(rowIdx)}
              onCellExpand={() => {
                if (expandedRows.has(rowIdx)) {
                  expandedRows.delete(rowIdx);
                } else {
                  expandedRows.add(rowIdx);
                }
                setExpandedRows(new Set(expandedRows));
              }}
            />
          );
        }

        // Type guard to check if data exists as it's optional
        const nestedData = row.data;
        if (!nestedData) {
          return null;
        }

        const expandedRecords = applySort(frameToRecords(nestedData), nestedData.fields, sortColumns);
        if (!expandedRecords.length) {
          return (
            <div className={styles.noDataNested}>
              <Trans i18nKey="grafana-ui.table.nested-table.no-data">No data</Trans>
            </div>
          );
        }

        return (
          <DataGrid<TableRow, TableSummaryRow>
            {...commonDataGridProps}
            className={clsx(styles.grid, styles.gridNested)}
            headerRowClass={clsx(styles.headerRow, { [styles.displayNone]: !hasNestedHeaders })}
            headerRowHeight={hasNestedHeaders ? TABLE.HEADER_HEIGHT : 0}
            columns={nestedColumns}
            rows={expandedRecords}
            renderers={renderers}
          />
        );
      },
      width: COLUMN.EXPANDER_WIDTH,
      minWidth: COLUMN.EXPANDER_WIDTH,
    }),
    [commonDataGridProps, data.fields.length, expandedRows, sortColumns, styles]
  );

  const fromFields = useCallback(
    (f: Field[], widths: number[]): FromFieldsResult => {
      const result: FromFieldsResult = {
        columns: [],
        cellRootRenderers: {},
        colsWithTooltip: {},
      };

      let lastRowIdx = -1;
      // shared when whole row will be styled by a single cell's color
      let rowCellStyle: Partial<CSSProperties> = {
        color: undefined,
        background: undefined,
      };

      f.forEach((field, i) => {
        const cellOptions = getCellOptions(field);
        const cellType = cellOptions.type;

        // make sure we use mappings exclusively if they exist, ignore default thresholds mode
        // we hack this by using the single color mode calculator
        if (cellType === TableCellDisplayMode.Pill && (field.config.mappings?.length ?? 0 > 0)) {
          field = {
            ...field,
            config: {
              ...field.config,
              color: {
                ...field.config.color,
                mode: FieldColorModeId.Fixed,
                fixedColor: field.config.color?.fixedColor ?? FALLBACK_COLOR,
              },
            },
          };
          field.display = getDisplayProcessor({ field, theme });
        }

        // attach JSONCell custom display function to JSONView cell type
        if (cellType === TableCellDisplayMode.JSONView || field.type === FieldType.other) {
          field.display = displayJsonValue;
        }

        // For some cells, "aligning" the cell will mean aligning the inline contents of the cell with
        // the text-align css property, and for others, we'll use justify-content to align the cell
        // contents with flexbox. We always just get both and provide both when styling the cell.
        const textAlign = getAlignment(field);
        const justifyContent = getJustifyContent(textAlign);
        const footerStyles = getFooterStyles(justifyContent);
        const displayName = getDisplayName(field);
        const headerCellClass = getHeaderCellStyles(theme, justifyContent);
        const CellType = getCellRenderer(field, cellOptions);

        const cellInspect = isCellInspectEnabled(field);
        const showFilters = Boolean(field.config.filterable && onCellFilterAdded != null);
        const showActions = cellInspect || showFilters;
        const width = widths[i];

        // helps us avoid string cx and emotion per-cell
        const cellActionClassName = showActions
          ? clsx('table-cell-actions', getCellActionStyles(theme, textAlign))
          : undefined;

        const shouldOverflow = rowHeight !== 'auto' && (shouldTextOverflow(field) || Boolean(maxRowHeight));
        const textWrap = rowHeight === 'auto' || shouldTextWrap(field);
        const withTooltip = withDataLinksActionsTooltip(field, cellType);
        const canBeColorized = canFieldBeColorized(cellType, applyToRowBgFn);
        const cellStyleOptions: TableCellStyleOptions = {
          textAlign,
          textWrap,
          shouldOverflow,
          maxHeight: maxRowHeight,
        };

        result.colsWithTooltip[displayName] = withTooltip;

        const defaultCellStyles = getDefaultCellStyles(theme, cellStyleOptions);
        const cellSpecificStyles = getCellSpecificStyles(cellType, field, theme, cellStyleOptions);
        const linkStyles = getLinkStyles(theme, canBeColorized);
        const cellParentStyles = clsx(defaultCellStyles, linkStyles);
        const maxHeightClassName = maxRowHeight ? getMaxHeightCellStyles(theme, cellStyleOptions) : undefined;

        // TODO: in future extend this to ensure a non-classic color scheme is set with AutoCell

        // this fires first
        const renderCellRoot = (key: Key, props: CellRendererProps<TableRow, TableSummaryRow>): ReactNode => {
          const rowIdx = props.row.__index;

          // meh, this should be cached by the renderRow() call?
          if (rowIdx !== lastRowIdx) {
            lastRowIdx = rowIdx;

            rowCellStyle.color = undefined;
            rowCellStyle.background = undefined;

            // generate shared styles for whole row
            if (applyToRowBgFn != null) {
              rowCellStyle = { ...rowCellStyle, ...applyToRowBgFn(rowIdx) };
            }
          }

          let style: CSSProperties = { ...rowCellStyle };
          if (canBeColorized) {
            const value = props.row[props.column.key];
            const displayValue = field.display!(value); // this fires here to get colors, then again to get rendered value?
            const cellColorStyles = getCellColorInlineStyles(cellOptions, displayValue, applyToRowBgFn != null);
            Object.assign(style, cellColorStyles);
          }

          return (
            <Cell
              key={key}
              {...props}
              className={clsx(
                props.className,
                cellParentStyles,
                cellSpecificStyles != null && { [cellSpecificStyles]: maxRowHeight == null }
              )}
              style={style}
            />
          );
        };

        result.cellRootRenderers[displayName] = renderCellRoot;

        const renderBasicCellContent = (props: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
          const rowIdx = props.row.__index;
          const value = props.row[props.column.key];
          // TODO: it would be nice to get rid of passing height down as a prop. but this value
          // is cached so the cost of calling for every cell is low.
          // NOTE: some cell types still require a height to be passed down, so that's why string-based
          // cell types are going to just pass down the max cell height as a numeric height for those cells.
          const height = rowHeightFn(props.row);
          const frame = data;

          let result = (
            <>
              <CellType
                cellOptions={cellOptions}
                frame={frame}
                field={field}
                height={height}
                rowIdx={rowIdx}
                theme={theme}
                value={value}
                width={width}
                timeRange={timeRange}
                cellInspect={cellInspect}
                showFilters={showFilters}
                getActions={getCellActions}
                disableSanitizeHtml={disableSanitizeHtml}
                getTextColorForBackground={getTextColorForBackground}
              />
              {showActions && (
                <TableCellActions
                  field={field}
                  value={value}
                  cellOptions={cellOptions}
                  displayName={displayName}
                  cellInspect={cellInspect}
                  showFilters={showFilters}
                  className={cellActionClassName}
                  setInspectCell={setInspectCell}
                  onCellFilterAdded={onCellFilterAdded}
                />
              )}
            </>
          );

          if (maxRowHeight != null) {
            result = <div className={clsx(maxHeightClassName, cellSpecificStyles)}>{result}</div>;
          }

          return result;
        };

        // renderCellContent fires second.
        let renderCellContent = renderBasicCellContent;

        const tooltipFieldName = field.config.custom?.tooltip?.field;
        if (tooltipFieldName) {
          const tooltipField = data.fields.find(predicateByName(tooltipFieldName));
          if (tooltipField) {
            const tooltipDisplayName = getDisplayName(tooltipField);
            const tooltipCellOptions = getCellOptions(tooltipField);
            const tooltipFieldRenderer = getCellRenderer(tooltipField, tooltipCellOptions);

            const tooltipCellStyleOptions = {
              textAlign: getAlignment(tooltipField),
              textWrap: shouldTextWrap(tooltipField),
              shouldOverflow: false,
              maxHeight: maxRowHeight,
            } satisfies TableCellStyleOptions;
            const tooltipCanBeColorized = canFieldBeColorized(tooltipCellOptions.type, applyToRowBgFn);
            const tooltipDefaultStyles = getDefaultCellStyles(theme, tooltipCellStyleOptions);
            const tooltipSpecificStyles = getCellSpecificStyles(
              tooltipCellOptions.type,
              tooltipField,
              theme,
              tooltipCellStyleOptions
            );
            const tooltipLinkStyles = getLinkStyles(theme, tooltipCanBeColorized);
            const tooltipClasses = getTooltipStyles(theme, textAlign);

            const placement = field.config.custom?.tooltip?.placement ?? TableCellTooltipPlacement.Auto;
            const tooltipWidth =
              placement === TableCellTooltipPlacement.Left || placement === TableCellTooltipPlacement.Right
                ? tooltipField.config.custom?.width
                : width;

            const tooltipProps = {
              cellOptions: tooltipCellOptions,
              classes: tooltipClasses,
              className: clsx(
                tooltipClasses.tooltipContent,
                tooltipDefaultStyles,
                tooltipSpecificStyles,
                tooltipLinkStyles
              ),
              data,
              disableSanitizeHtml,
              field: tooltipField,
              getActions: getCellActions,
              getTextColorForBackground,
              gridRef,
              placement,
              renderer: tooltipFieldRenderer,
              tooltipField,
              theme,
              width: tooltipWidth,
            } satisfies Partial<React.ComponentProps<typeof TableCellTooltip>>;

            renderCellContent = (props: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
              // cached so we don't care about multiple calls.
              const tooltipHeight = rowHeightFn(props.row);
              let tooltipStyle: CSSProperties = { ...rowCellStyle };
              if (tooltipCanBeColorized) {
                const tooltipDisplayValue = tooltipField.display!(props.row[tooltipDisplayName]);
                const tooltipCellColorStyles = getCellColorInlineStyles(
                  tooltipCellOptions,
                  tooltipDisplayValue,
                  applyToRowBgFn != null
                );
                Object.assign(tooltipStyle, tooltipCellColorStyles);
              }

              return (
                <TableCellTooltip
                  {...tooltipProps}
                  height={tooltipHeight}
                  rowIdx={props.row.__index}
                  style={tooltipStyle}
                >
                  {renderBasicCellContent(props)}
                </TableCellTooltip>
              );
            };
          }
        }

        result.columns.push({
          field,
          key: displayName,
          name: displayName,
          width,
          headerCellClass,
          frozen: Math.min(frozenColumns, numFrozenColsFullyInView) > i,
          renderCell: renderCellContent,
          renderHeaderCell: ({ column, sortDirection }) => (
            <HeaderCell
              column={column}
              rows={rows}
              field={field}
              filter={filter}
              setFilter={setFilter}
              crossFilterOrder={crossFilterOrder}
              crossFilterRows={crossFilterRows}
              direction={sortDirection}
              showTypeIcons={showTypeIcons}
            />
          ),
          renderSummaryCell: () => {
            if (isCountRowsSet && i === 0) {
              return (
                <div className={footerStyles.footerCellCountRows}>
                  <span>
                    <Trans i18nKey="grafana-ui.table.count">Count</Trans>
                  </span>
                  <span>{footerCalcs[i]}</span>
                </div>
              );
            }
            return <div className={footerStyles.footerCell}>{footerCalcs[i]}</div>;
          },
        });
      });

      return result;
    },
    [
      applyToRowBgFn,
      crossFilterOrder,
      crossFilterRows,
      data,
      disableSanitizeHtml,
      filter,
      footerCalcs,
      frozenColumns,
      getCellActions,
      getCellColorInlineStyles,
      getTextColorForBackground,
      isCountRowsSet,
      maxRowHeight,
      numFrozenColsFullyInView,
      onCellFilterAdded,
      rowHeight,
      rowHeightFn,
      rows,
      setFilter,
      showTypeIcons,
      theme,
      timeRange,
    ]
  );

  // set up the first row's nested data and the nest field widths using useColWidths to avoid
  // unnecessary re-renders on re-size.
  const firstRowNestedData = useMemo(
    () => (hasNestedFrames ? rows.find((r) => r.data)?.data : undefined),
    [hasNestedFrames, rows]
  );
  const [nestedFieldWidths] = useColWidths(firstRowNestedData?.fields ?? [], availableWidth);

  const { columns, cellRootRenderers, colsWithTooltip } = useMemo(() => {
    const result = fromFields(visibleFields, widths);

    // if nested frames are present, augment the columns to include the nested table expander column.
    if (!firstRowNestedData) {
      return result;
    }

    // pre-calculate renderRow and expandedColumns based on the first nested frame's fields.
    const hasNestedHeaders = firstRowNestedData.meta?.custom?.noHeader !== true;
    const renderRow = renderRowFactory(firstRowNestedData.fields, panelContext, expandedRows, enableSharedCrosshair);
    const { columns: nestedColumns, cellRootRenderers: nestedCellRootRenderers } = fromFields(
      firstRowNestedData.fields,
      nestedFieldWidths
    );

    const expanderCellRenderer: CellRootRenderer = (key, props) => <Cell key={key} {...props} />;
    result.cellRootRenderers[EXPANDED_COLUMN_KEY] = expanderCellRenderer;

    // If we have nested frames, we need to add a column for the row expansion
    result.columns.unshift(
      buildNestedTableExpanderColumn(nestedColumns, hasNestedHeaders, {
        renderRow,
        renderCell: (key, props) => nestedCellRootRenderers[props.column.key](key, props),
      })
    );

    return result;
  }, [
    buildNestedTableExpanderColumn,
    enableSharedCrosshair,
    expandedRows,
    firstRowNestedData,
    fromFields,
    nestedFieldWidths,
    panelContext,
    visibleFields,
    widths,
  ]);

  // invalidate columns on every structureRev change. this supports width editing in the fieldConfig.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const structureRevColumns = useMemo(() => columns, [columns, structureRev]);
  const renderCellRoot: CellRootRenderer = useCallback(
    (key, props) => cellRootRenderers[props.column.key](key, props),
    [cellRootRenderers]
  );

  // we need to have variables with these exact names for the localization to work properly
  const itemsRangeStart = pageRangeStart;
  const displayedEnd = pageRangeEnd;
  const numRows = sortedRows.length;

  return (
    <>
      <DataGrid<TableRow, TableSummaryRow>
        {...commonDataGridProps}
        ref={gridRef}
        className={styles.grid}
        columns={structureRevColumns}
        rows={paginatedRows}
        headerRowClass={clsx(styles.headerRow, { [styles.displayNone]: noHeader })}
        headerRowHeight={headerHeight}
        onCellClick={({ column, row }, { clientX, clientY, preventGridDefault, target }) => {
          // Note: could be column.field; JS says yes, but TS says no!
          const field = columns[column.idx].field;

          if (
            colsWithTooltip[getDisplayName(field)] &&
            target instanceof HTMLElement &&
            // this walks up the tree to find either a faux link wrapper or the cell root
            // it then only proceeds if we matched the faux link wrapper
            target.closest('a[aria-haspopup], .rdg-cell')?.matches('a')
          ) {
            const rowIdx = row.__index;
            setTooltipState({
              coords: {
                clientX,
                clientY,
              },
              links: getCellLinks(field, rowIdx),
              actions: getCellActions(field, rowIdx),
            });

            preventGridDefault();
          }
        }}
        onCellKeyDown={
          hasNestedFrames
            ? (_, event) => {
                if (event.isDefaultPrevented()) {
                  // skip parent grid keyboard navigation if nested grid handled it
                  event.preventGridDefault();
                }
              }
            : null
        }
        renderers={{ renderRow, renderCell: renderCellRoot }}
      />

      {enablePagination && (
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
              {/* TODO: once TableRT is deprecated, we can update the localiziation
                    string with the more consistent variable names */}
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

/**
 * this is passed to the top-level `renderRow` prop on DataGrid. applies aria attributes and custom event handlers.
 */
const renderRowFactory =
  (fields: Field[], panelContext: PanelContext, expandedRows: Set<number>, enableSharedCrosshair: boolean) =>
  // eslint-disable-next-line react/display-name
  (key: React.Key, props: RenderRowProps<TableRow, TableSummaryRow>): React.ReactNode => {
    const { row } = props;
    const rowIdx = row.__index;
    const isExpanded = expandedRows.has(rowIdx);

    // Don't render non expanded child rows
    if (row.__depth === 1 && !isExpanded) {
      return null;
    }

    // Add aria-expanded to parent rows that have nested data
    if (row.data) {
      return <Row key={key} {...props} aria-expanded={isExpanded} />;
    }

    const handlers: Partial<typeof props> = {};
    if (enableSharedCrosshair) {
      const timeField = fields.find((f) => f.type === FieldType.time);
      if (timeField) {
        handlers.onMouseEnter = () => {
          panelContext.eventBus.publish(
            new DataHoverEvent({
              point: {
                time: timeField?.values[rowIdx],
              },
            })
          );
        };
        handlers.onMouseLeave = () => {
          panelContext.eventBus.publish(new DataHoverClearEvent());
        };
      }
    }

    return <Row key={key} {...props} {...handlers} />;
  };
