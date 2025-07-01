import 'react-data-grid/lib/styles.css';
import { css, cx } from '@emotion/css';
import { Property } from 'csstype';
import { Key, ReactNode, useLayoutEffect, useMemo, useState } from 'react';
import {
  Cell,
  CellRendererProps,
  DataGrid,
  DataGridProps,
  RenderCellProps,
  RenderRowProps,
  Row,
  SortColumn,
} from 'react-data-grid';

import { DataHoverClearEvent, DataHoverEvent, Field, FieldType, GrafanaTheme2, ReducerID } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { ContextMenu } from '../../ContextMenu/ContextMenu';
import { MenuItem } from '../../Menu/MenuItem';
import { Pagination } from '../../Pagination/Pagination';
import { PanelContext, usePanelContext } from '../../PanelChrome';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { CellColors, TableCellDisplayMode } from '../types';

import { HeaderCell } from './Cells/HeaderCell';
import { RowExpander } from './Cells/RowExpander';
import { TableCellActions } from './Cells/TableCellActions';
import { getCellRenderer } from './Cells/renderers';
import { COLUMN, TABLE } from './constants';
import {
  useColumnResize,
  useFilteredRows,
  useFooterCalcs,
  usePaginatedRows,
  useRowHeight,
  useSortedRows,
  useTextWraps,
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
  getColumnTypes,
  computeColWidths,
  applySort,
  getCellColors,
  getCellOptions,
} from './utils';

type CellRootRenderer = (key: React.Key, props: CellRendererProps<TableRow, TableSummaryRow>) => React.ReactNode;

export function TableNG(props: TableNGProps) {
  const {
    cellHeight,
    data,
    enablePagination,
    enableSharedCrosshair = false,
    enableVirtualization,
    footerOptions,
    getActions,
    height,
    initialSortBy,
    noHeader,
    onCellFilterAdded,
    onColumnResize,
    onSortByChange,
    replaceVariables,
    showTypeIcons,
    structureRev,
    width,
  } = props;

  const theme = useTheme2();
  const styles = useStyles2(getGridStyles, {
    enablePagination,
    noHeader,
  });
  const panelContext = usePanelContext();

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
  const columnTypes = useMemo(() => getColumnTypes(data.fields), [data.fields]);
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
  } = useSortedRows(filteredRows, data.fields, { columnTypes, hasNestedFrames, initialSortBy });

  const defaultRowHeight = useMemo(() => getDefaultRowHeight(theme, cellHeight), [theme, cellHeight]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // vt scrollbar accounting for column auto-sizing
  const visibleFields = useMemo(() => getVisibleFields(data.fields), [data.fields]);
  const availableWidth = useMemo(
    () => (hasNestedFrames ? width - COLUMN.EXPANDER_WIDTH : width),
    [width, hasNestedFrames]
  );
  const widths = useMemo(() => computeColWidths(visibleFields, availableWidth), [visibleFields, availableWidth]);
  const rowHeight = useRowHeight(widths, visibleFields, hasNestedFrames, defaultRowHeight, expandedRows);

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
    hasHeader,
    hasFooter,
    rowHeight,
  });

  // Create a map of column key to text wrap
  const textWraps = useTextWraps(data.fields);
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
        headerRowClass: styles.headerRow,
        headerRowHeight: noHeader ? 0 : TABLE.HEADER_ROW_HEIGHT,
        bottomSummaryRows: hasFooter ? [{}] : undefined,
      }) satisfies Partial<DataGridProps<TableRow, TableSummaryRow>>,
    [
      enableVirtualization,
      resizeHandler,
      sortColumns,
      rowHeight,
      styles.headerRow,
      noHeader,
      hasFooter,
      setSortColumns,
      onSortByChange,
    ]
  );

  interface Schema {
    columns: TableColumn[];
    cellRootRenderers: Record<string, CellRootRenderer>;
  }

  const { columns, cellRootRenderers } = useMemo(() => {
    const fromFields = (f: Field[], widths: number[]) => {
      const result: Schema = {
        columns: [],
        cellRootRenderers: {},
      };

      f.forEach((field, i) => {
        const justifyContent = getTextAlign(field);
        const footerStyles = getFooterStyles(justifyContent);
        const displayName = getDisplayName(field);
        const headerCellClass = getHeaderCellStyles(theme, justifyContent).headerCell;
        const cellOptions = getCellOptions(field);
        const renderFieldCell = getCellRenderer(field, cellOptions);

        const cellInspect = Boolean(field.config.custom?.inspect);
        const showFilters = Boolean(field.config.filterable && onCellFilterAdded != null);
        const showActions = cellInspect || showFilters;
        const width = widths[i];
        const frame = data;

        // helps us avoid string cx and emotion per-cell
        const cellActionClassName = showActions
          ? cx(
              'table-cell-actions',
              styles.cellActions,
              justifyContent === 'flex-end' ? styles.cellActionsEnd : styles.cellActionsStart
            )
          : undefined;

        const cellType = cellOptions.type;
        const fieldType = columnTypes[displayName];
        const shouldWrap = textWraps[displayName];
        const shouldOverflow = shouldTextOverflow(fieldType, cellType, shouldWrap, cellInspect);

        let lastRowIdx = -1;
        let _rowHeight = 0;

        // this fires first
        const renderCellRoot = (key: Key, props: CellRendererProps<TableRow, TableSummaryRow>): ReactNode => {
          const rowIdx = props.row.__index;
          const value = props.row[props.column.key];

          // meh, this should be cached by the renderRow() call?
          if (rowIdx !== lastRowIdx) {
            _rowHeight = typeof rowHeight === 'function' ? rowHeight(props.row) : rowHeight;
            lastRowIdx = rowIdx;
          }

          let colors: CellColors;

          if (applyToRowBgFn != null) {
            colors = applyToRowBgFn(props.rowIdx);
          } else if (cellType !== TableCellDisplayMode.Auto) {
            const displayValue = field.display!(value); // this fires here to get colors, then again to get rendered value?
            colors = getCellColors(theme, cellOptions, displayValue);
          } else {
            colors = {};
          }

          const cellStyle = getCellStyles(theme, field, _rowHeight, shouldWrap, shouldOverflow, colors);

          return (
            <Cell
              key={key}
              {...props}
              className={cx(props.className, cellStyle.cell)}
              style={{ color: colors.textColor ?? 'inherit' }}
            />
          );
        };

        result.cellRootRenderers[displayName] = renderCellRoot;

        // this fires second
        const renderCellContent = (props: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
          const rowIdx = props.row.__index;
          const value = props.row[props.column.key];

          // TODO: defer until click?
          const actions = getActions?.(frame, field, props.row.__index, replaceVariables);

          return (
            <>
              {renderFieldCell({
                actions,
                cellOptions,
                frame,
                field,
                height,
                justifyContent,
                rowIdx,
                theme,
                value,
                width,
                cellInspect,
                showFilters,
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
          renderHeaderCell: ({ column, sortDirection }): JSX.Element => (
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
          return (
            <RowExpander
              height={defaultRowHeight}
              isExpanded={expandedRows[row.__index] ?? false}
              onCellExpand={() => {
                setExpandedRows({ ...expandedRows, [row.__index]: !expandedRows[row.__index] });
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

        return (
          <DataGrid<TableRow, TableSummaryRow>
            {...commonDataGridProps}
            className={cx(styles.grid, styles.gridNested)}
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
    availableWidth,
    commonDataGridProps,
    crossFilterOrder,
    crossFilterRows,
    data,
    defaultRowHeight,
    enableSharedCrosshair,
    expandedRows,
    filter,
    footerCalcs,
    getActions,
    hasNestedFrames,
    isCountRowsSet,
    onCellFilterAdded,
    panelContext,
    replaceVariables,
    rows,
    rowHeight,
    setFilter,
    showTypeIcons,
    sortColumns,
    styles,
    theme,
    visibleFields,
    widths,
    applyToRowBgFn,
    columnTypes,
    height,
    textWraps,
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

  return (
    <>
      <DataGrid<TableRow, TableSummaryRow>
        {...commonDataGridProps}
        className={styles.grid}
        columns={structureRevColumns}
        rows={paginatedRows}
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
  (
    fields: Field[],
    panelContext: PanelContext,
    expandedRows: Record<string, boolean>,
    enableSharedCrosshair: boolean
  ) =>
  (key: React.Key, props: RenderRowProps<TableRow, TableSummaryRow>): React.ReactNode => {
    const { row } = props;
    const rowIdx = row.__index;
    const isExpanded = !!expandedRows[rowIdx];

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
  { enablePagination, noHeader }: { enablePagination?: boolean; noHeader?: boolean }
) => ({
  grid: css({
    '--rdg-background-color': theme.colors.background.primary,
    '--rdg-header-background-color': theme.colors.background.primary,
    '--rdg-border-color': theme.isDark ? '#282b30' : '#ebebec',
    '--rdg-color': theme.colors.text.primary,

    // note: this cannot have any transparency since default cells that
    // overlay/overflow on hover inherit this background and need to occlude cells below
    '--rdg-row-hover-background-color': theme.isDark ? '#212428' : '#f4f5f5',

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
    width: `calc(100% - ${COLUMN.EXPANDER_WIDTH - 1}px)`,
    overflow: 'visible',
    marginLeft: COLUMN.EXPANDER_WIDTH - 1,
  }),
  cellNested: css({
    '&[aria-selected=true]': {
      outline: 'none',
    },
  }),
  cellActions: css({
    display: 'none',
    position: 'absolute',
    top: 0,
    margin: 'auto',
    height: '100%',
    color: theme.colors.text.primary,
    background: theme.isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.7)',
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
    ...(noHeader && { display: 'none' }),
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

const getHeaderCellStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent) => ({
  headerCell: css({
    display: 'flex',
    gap: theme.spacing(0.5),
    zIndex: theme.zIndex.tooltip - 1,
    paddingInline: TABLE.CELL_PADDING,
    paddingBlock: TABLE.CELL_PADDING,
    borderInlineEnd: 'none',
    justifyContent,
  }),
});

const getCellStyles = (
  theme: GrafanaTheme2,
  field: Field,
  rowHeight: number,
  shouldWrap: boolean,
  shouldOverflow: boolean,
  colors: CellColors
) => ({
  cell: css({
    textOverflow: 'initial',
    background: colors.bgColor ?? 'inherit',
    alignContent: 'center',
    justifyContent: getTextAlign(field),
    paddingInline: TABLE.CELL_PADDING,
    height: '100%',
    minHeight: rowHeight, // min height interacts with the fit-content property on the overflow container
    ...(shouldWrap && { whiteSpace: 'pre-line' }),
    '&:last-child': {
      borderInlineEnd: 'none',
    },
    '&:hover': {
      background: colors.bgHoverColor,
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
  }),
});
