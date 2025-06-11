import 'react-data-grid/lib/styles.css';
import { css, cx } from '@emotion/css';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DataGrid, DataGridHandle, RenderCellProps, RenderRowProps, Row } from 'react-data-grid';
import { useMeasure } from 'react-use';

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
import { TableNGProps, TableRow, TableSummaryRow, TableColumn, CellColors, ColumnTypes } from './types';
import {
  frameToRecords,
  getCellColors,
  getDefaultRowHeight,
  getDisplayName,
  getFooterStyles,
  getTextAlign,
  handleSort,
  shouldTextOverflow,
} from './utils';

export function TableNG(props: TableNGProps) {
  const {
    cellHeight,
    data,
    enablePagination,
    enableSharedCrosshair,
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
  const styles = useStyles2(getStyles2, {
    enablePagination,
    noHeader,
  });
  const panelContext = usePanelContext();

  const [isInspecting, setIsInspecting] = useState(false);

  const gridHandle = useRef<DataGridHandle>(null);
  const [paginationWrapperRef, { height: paginationHeight }] = useMeasure<HTMLDivElement>();

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
    height,
    width,
    hasHeader,
    hasFooter,
    paginationHeight,
    defaultRowHeight,
  });

  const footerCalcs = useFooterCalcs(sortedRows, data.fields, { enabled: hasFooter, footerOptions, isCountRowsSet });

  // Create a map of column key to text wrap
  const textWraps = useTextWraps(data.fields);

  // const [expandedRows]?

  // const [scrollPos, setScrollPos] = useState(0);

  // vt scrollbar accounting for column auto-sizing
  const scrollbarWidth = useScrollbarWidth(gridHandle, props, paginatedRows);

  // TODO maybe this ought to be slightly debounced.
  const widths = useMemo(
    () => computeColWidths(data.fields, width - scrollbarWidth),
    [data.fields, width, scrollbarWidth]
  );

  // TODO: skip hidden
  const columns = useMemo<TableColumn[]>((): TableColumn[] => {
    return data.fields.map((field, i): TableColumn => {
      const justifyColumnContent = getTextAlign(field);
      const footerStyles = getFooterStyles(justifyColumnContent);
      const displayName = getDisplayName(field);
      const cellClasses = getCellClasses(field, styles, columnTypes, textWraps, displayName);

      return {
        field,
        key: field.name,
        name: field.name,
        width: widths[i],
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
              handleSort(columnKey, direction, isMultiSort, setSortColumns, sortColumns, onSortByChange);
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
  }, [
    columnTypes,
    crossFilterOrder,
    crossFilterRows,
    data,
    defaultRowHeight,
    filter,
    footerCalcs,
    getActions,
    isCountRowsSet,
    memoizedRows,
    onCellFilterAdded,
    onColumnResize,
    onSortByChange,
    replaceVariables,
    setFilter,
    setSortColumns,
    showTypeIcons,
    sortColumns,
    styles,
    textWraps,
    theme,
    widths,
  ]);

  const hasSubTable = false;

  // todo: don't re-init this on each memoizedData change, only schema/config changes
  const rowHeight = useRowHeight(columns, data, hasSubTable, defaultRowHeight);

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
        defaultColumnOptions={{
          minWidth: 50,
          resizable: true,
          sortable: true,
          // draggable: true,
        }}
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
            renderRow(key, rowProps, [], panelContext, data, enableSharedCrosshair ?? false),
        }}
      />
      {enablePagination && (
        <div className={styles.paginationContainer} ref={paginationWrapperRef}>
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
              onClick={() => {
                setIsInspecting(true);
              }}
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

export function renderRow(
  key: React.Key,
  props: RenderRowProps<TableRow, TableSummaryRow>,
  expandedRows: number[],
  panelContext: PanelContext,
  data: DataFrame,
  enableSharedCrosshair: boolean
): React.ReactNode {
  // Let's render row level things here!
  // i.e. we can look at row styles and such here
  const { row } = props;
  const rowIdx = Number(row.__index);
  const isExpanded = expandedRows.includes(rowIdx);

  // Don't render non expanded child rows
  if (Number(row.__depth) === 1 && !isExpanded) {
    return null;
  }

  // Add aria-expanded to parent rows that have nested data
  if (row.data) {
    return <Row key={key} {...props} aria-expanded={isExpanded} />;
  }

  const timeField = data?.fields.find((f) => f.type === FieldType.time);
  const onRowHover =
    enableSharedCrosshair && timeField
      ? () => {
          panelContext.eventBus.publish(
            new DataHoverEvent({
              point: {
                time: timeField.values[rowIdx],
              },
            })
          );
        }
      : undefined;
  const onRowLeave = enableSharedCrosshair
    ? () => {
        panelContext.eventBus.publish(new DataHoverClearEvent());
      }
    : undefined;

  return <Row key={key} {...props} onMouseEnter={onRowHover} onMouseLeave={onRowLeave} />;
}

const getStyles2 = (
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

    // TODO: hate this magic pixel, lets see if there's a flexbox-based way to dynamically
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
        paddingInline: TABLE.CELL_PADDING,
        paddingBlock: TABLE.CELL_PADDING,
        borderInlineEnd: 'none',
      },
    },

    '.rdg-summary-row': {
      '.rdg-cell': {
        paddingInline: TABLE.CELL_PADDING,
        paddingBlock: TABLE.CELL_PADDING,
      },
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
      zIndex: theme.zIndex.tooltip,
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

// 1. manual sizing minWidth is hard-coded to 50px, we set this in RDG since it enforces the hard limit correctly
// 2. if minWidth is configured in fieldConfig (or defaults to 150), it serves as the bottom of the auto-size clamp
function computeColWidths(fields: Field[], availWidth: number) {
  // TODO: skip hidden

  let autoCount = 0;
  let definedWidth = 0;

  return fields
    .map((field, i) => {
      const width: number = field.config.custom?.width ?? 0;

      if (width === 0) {
        autoCount++;
      } else {
        definedWidth += width;
      }

      return width;
    })
    .map(
      (width, i) =>
        width ||
        Math.max(fields[i].config.custom?.minWidth ?? COLUMN.DEFAULT_WIDTH, (availWidth - definedWidth) / autoCount)
    );
}

function getRowBgFn(field: Field, theme: GrafanaTheme2): ((rowIndex: number) => CellColors) | void {
  const fieldOptions = field.config.custom;
  const fieldDisplay = field.display;
  if (
    fieldDisplay !== undefined &&
    fieldOptions !== undefined &&
    fieldOptions.cellOptions !== undefined &&
    fieldOptions.cellOptions.type === TableCellDisplayMode.ColorBackground &&
    fieldOptions.cellOptions.applyToRow
  ) {
    return (rowIndex: number): CellColors => {
      const display = fieldDisplay(field.values[rowIndex]);
      const colors = getCellColors(theme, fieldOptions.cellOptions, display);
      return colors;
    };
  }
}

function getCellClasses(
  field: Field,
  styles: ReturnType<typeof getStyles2>,
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
      if (field.config.custom?.cellOptions.wrapText) {
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
hidden
overlay/expand on hover
active line and cell styling
subtable/ expand
-----
enable pagination disables footer?
pagination + text wrap...
auto-cell: can we deprecate in favor of newer RDG options?
overflow hover at the bottom of paginated table
-----
accessible sorting and filtering
accessible table navigation
action, inspect, and context UX need to be consolidated a bit
*/
