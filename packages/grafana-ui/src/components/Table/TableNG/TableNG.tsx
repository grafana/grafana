import 'react-data-grid/lib/styles.css';
import { css } from '@emotion/css';
import { clsx } from 'clsx';
import { Property } from 'csstype';
import { CSSProperties, Key, ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Cell,
  CellRendererProps,
  DataGrid,
  DataGridHandle,
  DataGridProps,
  RenderCellProps,
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
  GrafanaTheme2,
  ReducerID,
} from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { FieldColorModeId, TableCellHeight } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { ContextMenu } from '../../ContextMenu/ContextMenu';
import { MenuItem } from '../../Menu/MenuItem';
import { Pagination } from '../../Pagination/Pagination';
import { PanelContext, usePanelContext } from '../../PanelChrome';
import { DataLinksActionsTooltip } from '../DataLinksActionsTooltip';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { TableCellDisplayMode } from '../types';
import { DataLinksActionsTooltipState } from '../utils';

import { HeaderCell } from './Cells/HeaderCell';
import { RowExpander } from './Cells/RowExpander';
import { TableCellActions } from './Cells/TableCellActions';
import { getCellRenderer } from './Cells/renderers';
import { COLUMN, TABLE } from './constants';
import {
  useColumnResize,
  useFilteredRows,
  useFooterCalcs,
  useHeaderHeight,
  usePaginatedRows,
  useRowHeight,
  useScrollbarWidth,
  useSortedRows,
  useTypographyCtx,
} from './hooks';
import { TableNGProps, TableRow, TableSummaryRow, TableColumn, ContextMenuProps } from './types';
import {
  frameToRecords,
  getDefaultRowHeight,
  getDisplayName,
  getIsNestedTable,
  getTextAlign,
  getVisibleFields,
  shouldTextOverflow,
  getApplyToRowBgFn,
  computeColWidths,
  applySort,
  getCellColors,
  getCellOptions,
  shouldTextWrap,
  isCellInspectEnabled,
  getCellLinks,
  withDataLinksActionsTooltip,
} from './utils';

type CellRootRenderer = (key: React.Key, props: CellRendererProps<TableRow, TableSummaryRow>) => React.ReactNode;

export function TableNG(props: TableNGProps) {
  const {
    cellHeight,
    data,
    enablePagination = false,
    enableSharedCrosshair = false,
    enableVirtualization,
    footerOptions,
    getActions = () => [],
    height,
    initialSortBy,
    noHeader,
    onCellFilterAdded,
    onColumnResize,
    onSortByChange,
    showTypeIcons,
    structureRev,
    transparent,
    width,
  } = props;

  const theme = useTheme2();
  const styles = useStyles2(getGridStyles, {
    enablePagination,
    transparent,
  });
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

  const [contextMenuProps, setContextMenuProps] = useState<ContextMenuProps | null>(null);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  const resizeHandler = useColumnResize(onColumnResize);

  useLayoutEffect(() => {
    if (!isContextMenuOpen) {
      return;
    }

    function onClick(_event: MouseEvent) {
      setIsContextMenuOpen(false);
    }

    window.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('click', onClick);
    };
  }, [isContextMenuOpen]);

  const rows = useMemo(() => frameToRecords(data), [data]);
  const hasNestedFrames = useMemo(() => getIsNestedTable(data.fields), [data]);

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

  const defaultRowHeight = getDefaultRowHeight(theme, cellHeight);
  const defaultHeaderHeight = getDefaultRowHeight(theme, TableCellHeight.Sm);
  const [isInspecting, setIsInspecting] = useState(false);
  const [expandedRows, setExpandedRows] = useState(() => new Set<number>());

  // vt scrollbar accounting for column auto-sizing
  const visibleFields = useMemo(() => getVisibleFields(data.fields), [data.fields]);
  const gridRef = useRef<DataGridHandle>(null);
  const scrollbarWidth = useScrollbarWidth(gridRef, height, sortedRows);
  const availableWidth = useMemo(
    () => (hasNestedFrames ? width - COLUMN.EXPANDER_WIDTH : width) - scrollbarWidth,
    [width, hasNestedFrames, scrollbarWidth]
  );
  const typographyCtx = useTypographyCtx();
  const widths = useMemo(() => computeColWidths(visibleFields, availableWidth), [visibleFields, availableWidth]);
  const headerHeight = useHeaderHeight({
    columnWidths: widths,
    fields: visibleFields,
    enabled: hasHeader,
    defaultHeight: defaultHeaderHeight,
    sortColumns,
    showTypeIcons: showTypeIcons ?? false,
    typographyCtx,
  });
  const rowHeight = useRowHeight({
    columnWidths: widths,
    fields: visibleFields,
    hasNestedFrames,
    defaultHeight: defaultRowHeight,
    headerHeight,
    expandedRows,
    typographyCtx,
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
    footerHeight: hasFooter ? defaultRowHeight : 0,
    rowHeight,
  });

  // Create a map of column key to text wrap
  const footerCalcs = useFooterCalcs(sortedRows, data.fields, { enabled: hasFooter, footerOptions, isCountRowsSet });
  const applyToRowBgFn = useMemo(() => getApplyToRowBgFn(data.fields, theme) ?? undefined, [data.fields, theme]);

  const renderRow = useMemo(
    () => renderRowFactory(data.fields, panelContext, expandedRows, enableSharedCrosshair),
    [data, enableSharedCrosshair, expandedRows, panelContext]
  );

  const commonDataGridProps = useMemo(
    () =>
      ({
        enableVirtualization,
        defaultColumnOptions: {
          minWidth: 50,
          resizable: true,
          sortable: true,
          // draggable: true,
        },
        onCellContextMenu: ({ row, column }, event) => {
          // in nested tables, it's possible for this event to trigger in a column header
          // when holding Ctrl for multi-row sort.
          if (column.key === 'expanded') {
            return;
          }

          event.preventGridDefault();
          // Do not show the default context menu
          event.preventDefault();

          const cellValue = row[column.key];
          setContextMenuProps({
            // rowIdx: rows.indexOf(row),
            value: String(cellValue ?? ''),
            top: event.clientY,
            left: event.clientX,
          });

          setIsContextMenuOpen(true);
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

  interface Schema {
    columns: TableColumn[];
    cellRootRenderers: Record<string, CellRootRenderer>;
    colsWithTooltip: Record<string, boolean>;
  }

  const { columns, cellRootRenderers, colsWithTooltip } = useMemo(() => {
    const fromFields = (f: Field[], widths: number[]) => {
      const result: Schema = {
        columns: [],
        cellRootRenderers: {},
        colsWithTooltip: {},
      };

      let lastRowIdx = -1;
      let _rowHeight = 0;
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

        const justifyContent = getTextAlign(field);
        const footerStyles = getFooterStyles(justifyContent);
        const displayName = getDisplayName(field);
        const headerCellClass = getHeaderCellStyles(theme, justifyContent);
        const renderFieldCell = getCellRenderer(field, cellOptions);

        const cellInspect = isCellInspectEnabled(field);
        const showFilters = Boolean(field.config.filterable && onCellFilterAdded != null);
        const showActions = cellInspect || showFilters;
        const width = widths[i];

        // helps us avoid string cx and emotion per-cell
        const cellActionClassName = showActions
          ? clsx(
              'table-cell-actions',
              styles.cellActions,
              justifyContent === 'flex-end' ? styles.cellActionsEnd : styles.cellActionsStart
            )
          : undefined;

        const shouldOverflow = shouldTextOverflow(field);
        const shouldWrap = shouldTextWrap(field);
        const withTooltip = withDataLinksActionsTooltip(field, cellType);
        const canBeColorized =
          cellType === TableCellDisplayMode.ColorBackground || cellType === TableCellDisplayMode.ColorText;

        result.colsWithTooltip[displayName] = withTooltip;

        // get static cell class based on col props

        let cellClass = '';

        switch (cellType) {
          case TableCellDisplayMode.Auto:
          case TableCellDisplayMode.ColorBackground:
          case TableCellDisplayMode.ColorText:
          case TableCellDisplayMode.DataLinks:
            cellClass = getCellStyles(theme, justifyContent, shouldWrap, shouldOverflow, withTooltip, canBeColorized);
            break;
        }

        // TODO: in future extend this to ensure a non-classic color scheme is set with AutoCell

        // this fires first
        const renderCellRoot = (key: Key, props: CellRendererProps<TableRow, TableSummaryRow>): ReactNode => {
          const rowIdx = props.row.__index;

          // meh, this should be cached by the renderRow() call?
          if (rowIdx !== lastRowIdx) {
            _rowHeight = typeof rowHeight === 'function' ? rowHeight(props.row) : rowHeight;
            lastRowIdx = rowIdx;

            rowCellStyle.color = undefined;
            rowCellStyle.background = undefined;

            // generate shared styles for whole row
            if (applyToRowBgFn != null) {
              let { textColor, bgColor } = applyToRowBgFn(rowIdx);
              rowCellStyle.color = textColor;
              rowCellStyle.background = bgColor;
            }
          }

          let style: CSSProperties | undefined;

          if (rowCellStyle.color != null || rowCellStyle.background != null) {
            style = rowCellStyle;
          }
          // apply background for cell types which can have a background and have proper
          else if (canBeColorized) {
            const value = props.row[props.column.key];
            const displayValue = field.display!(value); // this fires here to get colors, then again to get rendered value?
            let { textColor, bgColor } = getCellColors(theme, cellOptions, displayValue);
            style = {
              color: textColor,
              background: bgColor,
            };
          }

          return <Cell key={key} {...props} className={clsx(props.className, cellClass)} style={style} />; // TODO: remove expensive concat
        };

        result.cellRootRenderers[displayName] = renderCellRoot;

        // this fires second
        const renderCellContent = (props: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
          const rowIdx = props.row.__index;
          const value = props.row[props.column.key];
          const frame = data;

          return (
            <>
              {renderFieldCell({
                cellOptions,
                frame,
                field,
                height: _rowHeight,
                justifyContent,
                rowIdx,
                theme,
                value,
                width,
                cellInspect,
                showFilters,
                getActions: getCellActions,
              })}
              {showActions && (
                <TableCellActions
                  field={field}
                  value={value}
                  cellOptions={cellOptions}
                  displayName={displayName}
                  cellInspect={cellInspect}
                  showFilters={showFilters}
                  className={cellActionClassName}
                  setIsInspecting={setIsInspecting}
                  setContextMenuProps={setContextMenuProps}
                  onCellFilterAdded={onCellFilterAdded}
                />
              )}
            </>
          );
        };

        const column: TableColumn = {
          field,
          key: displayName,
          name: displayName,
          width,
          headerCellClass,
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
        };

        result.columns.push(column);
      });

      return result;
    };

    const result = fromFields(visibleFields, widths);

    // handle nested frames rendering from here.
    if (!hasNestedFrames) {
      return result;
    }

    // pre-calculate renderRow and expandedColumns based on the first nested frame's fields.
    const firstNestedData = rows.find((r) => r.data)?.data;
    if (!firstNestedData) {
      return result;
    }

    const hasNestedHeaders = firstNestedData.meta?.custom?.noHeader !== true;
    const renderRow = renderRowFactory(firstNestedData.fields, panelContext, expandedRows, enableSharedCrosshair);
    const { columns: nestedColumns, cellRootRenderers: nestedCellRootRenderers } = fromFields(
      firstNestedData.fields,
      computeColWidths(firstNestedData.fields, availableWidth)
    );

    const renderCellRoot: CellRootRenderer = (key, props) => nestedCellRootRenderers[props.column.key](key, props);

    result.cellRootRenderers.expanded = (key, props) => <Cell key={key} {...props} />;

    // If we have nested frames, we need to add a column for the row expansion
    result.columns.unshift({
      key: 'expanded',
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
              height={defaultRowHeight}
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
            headerRowHeight={hasNestedHeaders ? defaultHeaderHeight : 0}
            columns={nestedColumns}
            rows={expandedRecords}
            renderers={{ renderRow, renderCell: renderCellRoot }}
          />
        );
      },
      width: COLUMN.EXPANDER_WIDTH,
      minWidth: COLUMN.EXPANDER_WIDTH,
    });

    return result;
  }, [
    applyToRowBgFn,
    availableWidth,
    commonDataGridProps,
    crossFilterOrder,
    crossFilterRows,
    data,
    defaultHeaderHeight,
    defaultRowHeight,
    enableSharedCrosshair,
    expandedRows,
    filter,
    footerCalcs,
    hasNestedFrames,
    isCountRowsSet,
    onCellFilterAdded,
    panelContext,
    rowHeight,
    rows,
    setFilter,
    showTypeIcons,
    sortColumns,
    styles,
    theme,
    visibleFields,
    widths,
    getCellActions,
  ]);

  // invalidate columns on every structureRev change. this supports width editing in the fieldConfig.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const structureRevColumns = useMemo(() => columns, [columns, structureRev]);

  // we need to have variables with these exact names for the localization to work properly
  const itemsRangeStart = pageRangeStart;
  const displayedEnd = pageRangeEnd;
  const numRows = sortedRows.length;

  const renderCellRoot: CellRootRenderer = (key, props) => {
    return cellRootRenderers[props.column.key](key, props);
  };

  const [tooltipState, setTooltipState] = useState<DataLinksActionsTooltipState>();

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
        onCellClick={({ column, row }, { clientX, clientY, preventGridDefault }) => {
          // Note: could be column.field; JS says yes, but TS says no!
          const field = columns[column.idx].field;

          if (colsWithTooltip[getDisplayName(field)]) {
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

      {isContextMenuOpen && (
        <ContextMenu
          x={contextMenuProps?.left || 0}
          y={contextMenuProps?.top || 0}
          renderMenuItems={() => (
            <MenuItem
              label={t('grafana-ui.table.inspect-menu-label', 'Inspect value')}
              onClick={() => setIsInspecting(true)}
              className={styles.menuItem}
            />
          )}
          focusOnOpen={false}
        />
      )}

      {isInspecting && (
        <TableCellInspector
          mode={contextMenuProps?.mode ?? TableCellInspectorMode.text}
          value={contextMenuProps?.value}
          onDismiss={() => {
            setIsInspecting(false);
            setContextMenuProps(null);
          }}
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

const getGridStyles = (
  theme: GrafanaTheme2,
  { enablePagination, transparent }: { enablePagination?: boolean; transparent?: boolean }
) => ({
  grid: css({
    '--rdg-background-color': transparent ? theme.colors.background.canvas : theme.colors.background.primary,
    '--rdg-header-background-color': transparent ? theme.colors.background.canvas : theme.colors.background.primary,
    '--rdg-border-color': theme.colors.border.weak,
    '--rdg-color': theme.colors.text.primary,

    // note: this cannot have any transparency since default cells that
    // overlay/overflow on hover inherit this background and need to occlude cells below
    '--rdg-row-background-color': transparent ? theme.colors.background.canvas : theme.colors.background.primary,
    '--rdg-row-hover-background-color': transparent
      ? theme.colors.background.primary
      : theme.colors.background.secondary,

    // TODO: magic 32px number is unfortunate. it would be better to have the content
    // flow using flexbox rather than hard-coding this size via a calc
    blockSize: enablePagination ? 'calc(100% - 32px)' : '100%',
    scrollbarWidth: 'thin',
    scrollbarColor: theme.isDark ? '#fff5 #fff1' : '#0005 #0001',

    border: 'none',

    '.rdg-summary-row': {
      '.rdg-cell': {
        zIndex: theme.zIndex.tooltip - 1,
        paddingInline: TABLE.CELL_PADDING,
        paddingBlock: TABLE.CELL_PADDING,
      },
    },
  }),
  gridNested: css({
    height: '100%',
    width: `calc(100% - ${COLUMN.EXPANDER_WIDTH - TABLE.CELL_PADDING * 2 - 1}px)`,
    overflow: 'visible',
    marginLeft: COLUMN.EXPANDER_WIDTH - TABLE.CELL_PADDING - 1,
    marginBlock: TABLE.CELL_PADDING,
  }),
  cellNested: css({
    '&[aria-selected=true]': {
      outline: 'none',
    },
  }),
  noDataNested: css({
    height: TABLE.NESTED_NO_DATA_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.h4.fontSize,
  }),
  cellActions: css({
    display: 'none',
    position: 'absolute',
    top: 0,
    margin: 'auto',
    height: '100%',
    color: theme.colors.text.primary,
    background: theme.isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    padding: theme.spacing.x0_5,
    paddingInlineStart: theme.spacing.x1,
  }),
  cellActionsEnd: css({
    left: 0,
  }),
  cellActionsStart: css({
    right: 0,
  }),
  headerRow: css({
    paddingBlockStart: 0,
    fontWeight: 'normal',
    '& .rdg-cell': {
      height: '100%',
      alignItems: 'flex-end',
    },
  }),
  displayNone: css({
    display: 'none',
  }),
  paginationContainer: css({
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    marginTop: '8px',
    width: '100%',
  }),
  paginationSummary: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1, 0, 2),
  }),
  menuItem: css({
    maxWidth: '200px',
  }),
});

const getFooterStyles = (justifyContent: Property.JustifyContent) => ({
  footerCellCountRows: css({
    display: 'flex',
    justifyContent: 'space-between',
  }),
  footerCell: css({
    display: 'flex',
    justifyContent: justifyContent || 'space-between',
  }),
});

const getHeaderCellStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent) =>
  css({
    display: 'flex',
    gap: theme.spacing(0.5),
    zIndex: theme.zIndex.tooltip - 1,
    paddingInline: TABLE.CELL_PADDING,
    paddingBlockEnd: TABLE.CELL_PADDING,
    justifyContent,
    '&:last-child': {
      borderInlineEnd: 'none',
    },
  });

const getCellStyles = (
  theme: GrafanaTheme2,
  justifyContent: Property.JustifyContent,
  shouldWrap: boolean,
  shouldOverflow: boolean,
  hasTooltip: boolean,
  isColorized: boolean
) =>
  css({
    display: 'flex',
    alignItems: 'center',
    justifyContent,
    paddingInline: TABLE.CELL_PADDING,
    minHeight: '100%',
    backgroundClip: 'padding-box !important', // helps when cells have a bg color
    ...(shouldWrap && { whiteSpace: 'pre-line' }),
    ...(hasTooltip && { cursor: 'pointer' }),

    '&:last-child': {
      borderInlineEnd: 'none',
    },

    // should omit if no cell actions, and no shouldOverflow
    '&:hover': {
      '.table-cell-actions': {
        display: 'flex',
      },
      ...(shouldOverflow && {
        zIndex: theme.zIndex.tooltip - 2,
        whiteSpace: 'pre-line',
        height: 'fit-content',
        minWidth: 'fit-content',
      }),
    },

    [hasTooltip ? '&' : 'a']: {
      cursor: 'pointer',
      ...(isColorized
        ? {
            color: 'inherit',
            textDecoration: 'underline',
          }
        : {
            color: theme.colors.text.link,
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }),
    },
  });
