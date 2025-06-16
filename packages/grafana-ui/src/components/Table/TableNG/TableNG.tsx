import 'react-data-grid/lib/styles.css';
import { css, cx } from '@emotion/css';
import { Property } from 'csstype';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DataGrid, DataGridHandle, RenderCellProps, RenderRowProps, Row } from 'react-data-grid';

import {
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  Field,
  FieldType,
  GrafanaTheme2,
  ReducerID,
} from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../themes/ThemeContext';
import { Trans, t } from '../../../utils/i18n';
import { ContextMenu } from '../../ContextMenu/ContextMenu';
import { MenuItem } from '../../Menu/MenuItem';
import { Pagination } from '../../Pagination/Pagination';
import { PanelContext, usePanelContext } from '../../PanelChrome';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';

import { HeaderCell } from './Cells/HeaderCell';
import { RowExpander } from './Cells/RowExpander';
import { TableCellNG } from './Cells/TableCellNG';
import { COLUMN, TABLE } from './constants';
import {
  useColumnTypes,
  useFilteredRows,
  useFooterCalcs,
  usePaginatedRows,
  useRowHeight,
  useScrollbarWidth,
  useSortedRows,
  useTextWraps,
} from './hooks';
import { TableNGProps, TableRow, TableSummaryRow, TableColumn, ColumnTypes } from './types';
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
  computeColWidths,
} from './utils';

export function TableNG(props: TableNGProps) {
  const {
    cellHeight,
    data,
    enablePagination,
    enableSharedCrosshair,
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

  const [isInspecting, setIsInspecting] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const gridHandle = useRef<DataGridHandle>(null);

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
  const columnTypes = useColumnTypes(data.fields);

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

  // vt scrollbar accounting for column auto-sizing
  const hasNestedFrames = useMemo(() => getIsNestedTable(data.fields), [data]);
  const scrollbarWidth = useScrollbarWidth(gridHandle, height, sortedRows, expandedRows);
  const visibleFields = useMemo(() => getVisibleFields(data.fields), [data.fields]);
  const availableWidth = useMemo(
    () => (hasNestedFrames ? width - scrollbarWidth - COLUMN.EXPANDER_WIDTH : width - scrollbarWidth),
    [width, hasNestedFrames, scrollbarWidth]
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

  const columns = useMemo<TableColumn[]>((): TableColumn[] => {
    const columnsFromFields = (f: Field[], w: number[]): TableColumn[] =>
      f.map((field, i): TableColumn => {
        const justifyColumnContent = getTextAlign(field);
        const footerStyles = getFooterStyles(justifyColumnContent);
        const displayName = getDisplayName(field);
        const cellClasses = getCellClasses(field, styles, columnTypes, textWraps, displayName);

        return {
          field,
          key: field.name,
          name: field.name,
          width: w[i],
          headerCellClass: field.type === FieldType.number ? styles.cellRight : null,
          cellClass: cellClasses.length > 0 ? cx(cellClasses) : undefined,
          renderCell: (props: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
            const { row } = props;
            const value = row[displayName];

            // Cell level rendering here
            return (
              <TableCellNG
                frame={data}
                key={displayName}
                value={value}
                field={field}
                theme={theme}
                height={defaultRowHeight}
                justifyContent={justifyColumnContent}
                rowIdx={row.__index}
                setIsInspecting={setIsInspecting}
                setContextMenuProps={setContextMenuProps}
                getActions={getActions}
                rowBg={getRowBgFn(field, theme) ?? undefined}
                onCellFilterAdded={onCellFilterAdded}
                replaceVariables={replaceVariables}
              />
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
              onColumnResize={onColumnResize}
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

    // If we have nested frames, we need to add a column for the row expansion
    // If nested frames, add expansion control column
    if (hasNestedFrames) {
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

          // If it's a child, render entire DataGrid at first column position
          let expandedColumns: TableColumn[] = [];
          let expandedRecords: TableRow[] = [];

          // Type guard to check if data exists as it's optional
          const nestedData = row.data;
          if (nestedData) {
            expandedColumns = columnsFromFields(nestedData.fields, computeColWidths(nestedData.fields, availableWidth));
            expandedRecords = frameToRecords(nestedData);
          }

          // TODO add renderHeaderCell HeaderCell's here and handle all features
          return (
            <DataGrid<TableRow, TableSummaryRow>
              enableVirtualization={enableVirtualization}
              className={cx(styles.grid, styles.gridNested)}
              rows={expandedRecords}
              columns={expandedColumns}
              rowHeight={rowHeight}
              headerRowHeight={row.data?.meta?.custom?.noHeader ? 0 : undefined}
            />
          );
        },
        width: COLUMN.EXPANDER_WIDTH,
        minWidth: COLUMN.EXPANDER_WIDTH,
      });
    }

    return result;
  }, [
    availableWidth,
    columnTypes,
    crossFilterOrder,
    crossFilterRows,
    data,
    defaultRowHeight,
    expandedRows,
    enableVirtualization,
    filter,
    footerCalcs,
    getActions,
    hasNestedFrames,
    isCountRowsSet,
    memoizedRows,
    onCellFilterAdded,
    onColumnResize,
    onSortByChange,
    replaceVariables,
    rowHeight,
    setFilter,
    setSortColumns,
    showTypeIcons,
    sortColumns,
    styles,
    textWraps,
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
        className={styles.grid}
        ref={gridHandle}
        columns={columns}
        rows={paginatedRows}
        enableVirtualization={enableVirtualization}
        defaultColumnOptions={{
          minWidth: 50,
          resizable: true,
          sortable: true,
          // draggable: true,
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
        onColumnWidthsChange={(widths) => {
          for (const [key, entry] of widths) {
            onColumnResize?.(key, entry.width);
          }
        }}
        sortColumns={sortColumns}
        rowHeight={rowHeight}
        headerRowClass={styles.dataGridHeaderRow}
        headerRowHeight={noHeader ? 0 : TABLE.HEADER_ROW_HEIGHT}
        bottomSummaryRows={hasFooter ? [{}] : undefined}
        renderers={{
          renderRow: (key, rowProps) =>
            renderRow(key, rowProps, expandedRows, panelContext, data, enableSharedCrosshair ?? false),
        }}
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

function renderRow(
  key: React.Key,
  props: RenderRowProps<TableRow, TableSummaryRow>,
  expandedRows: Record<string, boolean>,
  panelContext: PanelContext,
  data: DataFrame,
  enableSharedCrosshair: boolean
): React.ReactNode {
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

  const timeField = data?.fields.find((f) => f.type === FieldType.time);
  const handlers: Partial<typeof props> = {};
  if (enableSharedCrosshair && timeField) {
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
  return <Row key={key} {...props} {...handlers} />;
}

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

    '.rdg-cell': {
      // clip the overflow (like OG), without this the default is ellipsis
      textOverflow: 'initial',
      paddingInline: 0,

      '&:last-child': {
        borderInlineEnd: 'none',
      },
    },

    '.rdg-header-row': {
      fontWeight: 'normal',

      '.rdg-cell': {
        zIndex: theme.zIndex.tooltip - 1,
        paddingInline: TABLE.CELL_PADDING,
        paddingBlock: TABLE.CELL_PADDING,
        borderInlineEnd: 'none',
      },
    },

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
  cellWrapped: css({
    whiteSpace: 'pre-line',
  }),
  cellRight: css({
    textAlign: 'right',
  }),
  cellOverflow: css({
    '&:hover': {
      zIndex: theme.zIndex.tooltip - 2,
      whiteSpace: 'pre-line',
      height: 'min-content',
      minWidth: 'min-content',
    },
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
  dataGridHeaderRow: css({
    paddingBlockStart: 0,
    ...(noHeader && { display: 'none' }),
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

function getCellClasses(
  field: Field,
  styles: ReturnType<typeof getGridStyles>,
  columnTypes: ColumnTypes,
  textWraps: Record<string, boolean>,
  displayName: string
): string[] {
  const cellClasses = [];
  const cellType = field.config?.custom?.cellOptions?.type ?? TableCellDisplayMode.Auto;
  if (field.type === FieldType.number) {
    cellClasses.push(styles.cellRight);
  }
  if (shouldTextOverflow(displayName, columnTypes, textWraps[getDisplayName(field)], field, cellType)) {
    cellClasses.push(styles.cellOverflow);
  }
  switch (cellType) {
    case TableCellDisplayMode.Auto:
    case TableCellDisplayMode.ColorBackground:
    case TableCellDisplayMode.ColorBackgroundSolid:
    case TableCellDisplayMode.ColorText:
      if (field.config.custom?.cellOptions?.wrapText) {
        cellClasses.push(styles.cellWrapped);
      }
      break;
    default:
      break;
  }
  return cellClasses;
}

/*
TODO:
ad hoc filtering
min and max?
whole row color (applyToRow)
  - subtable might be impacted by this
subtable headers
-----
check what happens if we change initialSortBy
changing the display name via fieldOverrides breaks sorting
enable pagination disables footer?
revisit z-index stuff in the styles
-----
- Max row height
  - also, disable overflow?
- Text wrap column heading
- Field description
- Monospace (fieldOverride?)
	- default for number?
	- custom format
	- currency format
- Pagination, filter, and sort persistence via URL
- Field overrides for nested fields
-----
accessible sorting and filtering
accessible table navigation
action, inspect, and context UX need to be consolidated a bit
*/
