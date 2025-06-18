import 'react-data-grid/lib/styles.css';
import { css, cx } from '@emotion/css';
import { Property } from 'csstype';
import { debounce } from 'lodash';
import { Key, useLayoutEffect, useMemo, useState } from 'react';
import {
  Cell,
  CellRendererProps,
  DataGrid,
  DataGridProps,
  RenderCellProps,
  RenderRowProps,
  Row,
} from 'react-data-grid';

import { DataHoverClearEvent, DataHoverEvent, Field, FieldType, GrafanaTheme2, ReducerID } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { ContextMenu } from '../../ContextMenu/ContextMenu';
import { MenuItem } from '../../Menu/MenuItem';
import { Pagination } from '../../Pagination/Pagination';
import { PanelContext, usePanelContext } from '../../PanelChrome';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { CellColors } from '../types';

import { HeaderCell } from './Cells/HeaderCell';
import { RowExpander } from './Cells/RowExpander';
import { CELL_RENDERERS, TableCellNG } from './Cells/TableCellNG';
import { COLUMN, TABLE } from './constants';
import { useFilteredRows, useFooterCalcs, usePaginatedRows, useRowHeight, useSortedRows, useTextWraps } from './hooks';
import { TableNGProps, TableRow, TableSummaryRow, TableColumn, TableCellNGProps } from './types';
import {
  frameToRecords,
  getDefaultRowHeight,
  getDisplayName,
  getIsNestedTable,
  getTextAlign,
  getVisibleFields,
  updateSortColumns,
  shouldTextOverflow,
  getRowBgFn,
  getColumnTypes,
  computeColWidths,
  applySort,
  getCellColors,
  getCellOptions,
} from './utils';

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

  const [contextMenuProps, setContextMenuProps] = useState<{
    rowIdx?: number;
    value: string;
    mode?: TableCellInspectorMode.code | TableCellInspectorMode.text;
    top?: number;
    left?: number;
  } | null>(null);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

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

  const memoizedRows = useMemo(() => frameToRecords(data), [data]);
  const columnTypes = useMemo(() => getColumnTypes(data.fields), [data.fields]);

  const {
    rows: filteredRows,
    filter,
    setFilter,
    crossFilterOrder,
    crossFilterRows,
  } = useFilteredRows(memoizedRows, data.fields);

  const {
    rows: sortedRows,
    sortColumns,
    setSortColumns,
  } = useSortedRows(filteredRows, data.fields, {
    initialSortBy,
  });

  const defaultRowHeight = useMemo(() => getDefaultRowHeight(theme, cellHeight), [theme, cellHeight]);
  const [isInspecting, setIsInspecting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // vt scrollbar accounting for column auto-sizing
  const hasNestedFrames = useMemo(() => getIsNestedTable(data.fields), [data]);
  const visibleFields = useMemo(() => getVisibleFields(data.fields), [data.fields]);
  const visibleFieldsByDisplayName = useMemo(() => {
    const map: Record<string, Field> = {};
    for (const f of visibleFields) {
      map[getDisplayName(f)] = f;
    }
    return map;
  }, [visibleFields]);
  const availableWidth = useMemo(
    () => (hasNestedFrames ? width - COLUMN.EXPANDER_WIDTH : width),
    [width, hasNestedFrames]
  );
  const widths = useMemo(() => computeColWidths(visibleFields, availableWidth), [visibleFields, availableWidth]);
  const rowHeight = useRowHeight(widths, visibleFields, hasNestedFrames, defaultRowHeight, expandedRows);
  const debouncedResizeHandler = useMemo(() => {
    if (!onColumnResize) {
      return undefined;
    }
    return debounce((column, newSize) => {
      onColumnResize(column.key, Math.floor(newSize));
    }, 50) satisfies DataGridProps<TableRow, TableSummaryRow>['onColumnResize'];
  }, [onColumnResize]);

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
  const rowBg = useMemo(() => getRowBgFn(data.fields, theme) ?? undefined, [data.fields, theme]);

  const renderRow = useMemo(
    () => renderRowFactory(data.fields, panelContext, expandedRows, enableSharedCrosshair),
    [data, enableSharedCrosshair, expandedRows, panelContext]
  );

  const renderCell = useMemo(
    () => renderCellFactory(columnTypes, rowBg, rowHeight, textWraps, theme, visibleFieldsByDisplayName),
    [columnTypes, rowBg, rowHeight, textWraps, theme, visibleFieldsByDisplayName]
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
        sortColumns,
        rowHeight,
        headerRowClass: styles.headerRow,
        headerRowHeight: noHeader ? 0 : TABLE.HEADER_ROW_HEIGHT,
        bottomSummaryRows: hasFooter ? [{}] : undefined,
      }) satisfies Partial<DataGridProps<TableRow, TableSummaryRow>>,
    [enableVirtualization, hasFooter, noHeader, rowHeight, sortColumns, styles.headerRow]
  );

  const columns = useMemo<TableColumn[]>((): TableColumn[] => {
    const columnsFromFields = (f: Field[], w: number[]): TableColumn[] =>
      f.map((field, i): TableColumn => {
        const justifyColumnContent = getTextAlign(field);
        const footerStyles = getFooterStyles(justifyColumnContent);
        const displayName = getDisplayName(field);
        const headerCellClass = cx(styles.headerCell, field.type === FieldType.number ? styles.headerCellRight : null);
        const cellOptions = getCellOptions(field);
        const cellType = cellOptions?.type ?? TableCellDisplayMode.Auto;
        const renderFieldCell = CELL_RENDERERS[cellType];

        return {
          field,
          key: getDisplayName(field),
          name: getDisplayName(field),
          width: w[i],
          headerCellClass,
          renderCell: (props: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
            const p: Omit<TableCellNGProps, 'children'> = {
              actions: getActions?.(data, field, props.row.__index, replaceVariables),
              cellOptions,
              displayName,
              field,
              frame: data,
              height: typeof rowHeight === 'function' ? rowHeight(props.row) : rowHeight,
              justifyContent: justifyColumnContent,
              onCellFilterAdded,
              rowIdx: props.row.__index,
              setContextMenuProps,
              setIsInspecting,
              theme,
              value: props.row[displayName],
              width: widths[i],
            };
            return (
              <TableCellNG key={displayName} {...p}>
                {renderFieldCell(p)}
              </TableCellNG>
            );
          },
          renderHeaderCell: ({ column, sortDirection }): JSX.Element => (
            <HeaderCell
              column={column}
              rows={memoizedRows}
              field={field}
              onSort={(columnKey, direction, isMultiSort) => {
                const updatedSortColumns = updateSortColumns(columnKey, direction, isMultiSort, sortColumns);
                setSortColumns(updatedSortColumns);
                // Update panel context with the new sort order
                if (typeof onSortByChange === 'function') {
                  onSortByChange(
                    updatedSortColumns.map(({ columnKey, direction }) => ({
                      displayName: columnKey,
                      desc: direction === 'DESC',
                    }))
                  );
                }
              }}
              filter={filter}
              setFilter={setFilter}
              crossFilterOrder={crossFilterOrder}
              crossFilterRows={crossFilterRows}
              direction={sortDirection}
              justifyContent={justifyColumnContent}
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
      });

    const result: TableColumn[] = columnsFromFields(visibleFields, widths);

    // handle nested frames rendering from here.
    if (!hasNestedFrames) {
      return result;
    }

    // pre-calculate renderRow and expandedColumns based on the first nested frame's fields.
    const nestedData = memoizedRows.find((r) => r.data)?.data;
    if (!nestedData) {
      return result;
    }
    const renderRow = renderRowFactory(nestedData.fields, panelContext, expandedRows, enableSharedCrosshair);
    const expandedColumns = columnsFromFields(nestedData.fields, computeColWidths(nestedData.fields, availableWidth));

    // If we have nested frames, we need to add a column for the row expansion
    result.unshift({
      key: 'expanded',
      name: '',
      field: {
        name: '',
        type: FieldType.other,
        config: {},
        values: [],
      },
      cellClass(row) {
        if (Number(row.__depth) !== 0) {
          return styles.cellNested;
        }
        return;
      },
      colSpan(args) {
        return args.type === 'ROW' && Number(args.row.__depth) === 1 ? data.fields.length : 1;
      },
      renderCell: ({ row }) => {
        if (Number(row.__depth) === 0) {
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
            columns={expandedColumns}
            rows={expandedRecords}
            renderers={{ renderRow, renderCell }}
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
    memoizedRows,
    onCellFilterAdded,
    onSortByChange,
    panelContext,
    replaceVariables,
    renderCell,
    rowHeight,
    setFilter,
    setSortColumns,
    showTypeIcons,
    sortColumns,
    styles,
    theme,
    visibleFields,
    widths,
  ]);

  // we need to have variables with these exact names for the localization to work properly
  const itemsRangeStart = pageRangeStart;
  const displayedEnd = pageRangeEnd;
  const numRows = sortedRows.length;

  return (
    <>
      <DataGrid<TableRow, TableSummaryRow>
        {...commonDataGridProps}
        className={styles.grid}
        columns={columns}
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
        onCellContextMenu={({ row, column }, event) => {
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
        }}
        onColumnResize={debouncedResizeHandler}
        renderers={{ renderRow, renderCell }}
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

const renderRowFactory =
  (
    fields: Field[],
    panelContext: PanelContext,
    expandedRows: Record<string, boolean>,
    enableSharedCrosshair: boolean
  ) =>
  (key: React.Key, props: RenderRowProps<TableRow, TableSummaryRow>): React.ReactNode => {
    const { row } = props;
    const rowIdx = Number(row.__index);
    const isExpanded = !!expandedRows[rowIdx];

    // Don't render non expanded child rows
    if (Number(row.__depth) === 1 && !isExpanded) {
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

const renderCellFactory =
  (
    columnTypes: Record<string, FieldType>,
    rowBg: ((rowIdx: number) => CellColors) | undefined,
    rowHeight: number | ((row: TableRow) => number),
    textWraps: Record<string, boolean>,
    theme: GrafanaTheme2,
    visibleFieldsByDisplayName: Record<string, Field>
  ) =>
  (key: Key, props: CellRendererProps<TableRow, TableSummaryRow>) => {
    const displayName = props.column.key;
    const field = visibleFieldsByDisplayName[displayName];

    // exit early if we fail to look up the field from the column key.
    if (!field) {
      return <Cell key={key} {...props} />;
    }

    const cellOptions = getCellOptions(field);
    const cellType = cellOptions.type;
    const value = props.row[props.column.key];

    const colors: CellColors = (() => {
      if (rowBg) {
        return rowBg(props.rowIdx);
      }
      const displayValue = field.display?.(value);
      if (displayValue && cellOptions) {
        return getCellColors(theme, cellOptions, displayValue);
      }
      return {};
    })();

    const rh = typeof rowHeight === 'function' ? rowHeight(props.row) : rowHeight;
    const shouldOverflow = shouldTextOverflow(
      displayName,
      columnTypes,
      textWraps[getDisplayName(field)],
      field,
      cellType
    );
    const shouldWrap = textWraps[displayName] ?? false;
    const cellStyle = getCellStyles(theme, field, rh, shouldWrap, shouldOverflow, colors);

    return (
      <Cell
        key={key}
        {...props}
        className={cx(props.className, cellStyle.cell)}
        style={{ color: colors.textColor ?? 'inherit' }}
      />
    );
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

    // TODO: hate this magic number, lets see if there's a flexbox-based way to dynamically
    // size the pagination in when needed.
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
  headerCell: css({
    zIndex: theme.zIndex.tooltip - 1,
    paddingInline: TABLE.CELL_PADDING,
    paddingBlock: TABLE.CELL_PADDING,
    borderInlineEnd: 'none',
  }),
  headerRow: css({
    paddingBlockStart: 0,
    fontWeight: 'normal',
    ...(noHeader && { display: 'none' }),
  }),
  headerCellRight: css({
    textAlign: 'right',
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

/*
TODO:
enable pagination disables footer?
revisit z-index stuff in the styles
double click on header divider to resize width isn't triggering a resize in the field overrides
min and max (used for sparklines and gauge) need much better contextual info in the sidebar
width override does not apply after a manual resize with the handle
-----
- Max row height
  - also, disable overflow?
- Text wrap column heading
- Field description
- Field overrides for nested fields
- Monospace (fieldOverride?)
  - default for number?
  - custom format
  - currency format
- Pagination, filter, and sort persistence via URL
-----
accessible sorting and filtering
accessible table navigation
action, inspect, and context UX need to be consolidated a bit
*/
