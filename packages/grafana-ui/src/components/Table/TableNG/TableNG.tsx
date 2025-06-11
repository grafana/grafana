import 'react-data-grid/lib/styles.css';
import { css } from '@emotion/css';
import { useMemo, useRef } from 'react';
import { DataGrid, DataGridHandle, RenderRowProps, Row } from 'react-data-grid';
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
import { Trans } from '../../../utils/i18n';
import { Pagination } from '../../Pagination/Pagination';
import { PanelContext, usePanelContext } from '../../PanelChrome';

import { HeaderCell } from './Cells/HeaderCell';
import { COLUMN, TABLE } from './constants';
import { useProcessedRows, useRowHeight, useScrollbarWidth } from './hooks';
import { TableNGProps, TableRow, TableSummaryRow, TableColumn } from './types';
import { frameToRecords, getDefaultRowHeight, getFooterStyles, getTextAlign, handleSort } from './utils';

export function TableNG(props: TableNGProps) {
  const {
    cellHeight,
    data,
    enablePagination,
    enableSharedCrosshair,
    footerOptions,
    height,
    initialSortBy,
    noHeader,
    onColumnResize,
    onSortByChange,
    showTypeIcons,
    width,
  } = props;

  const theme = useTheme2();
  const defaultRowHeight = getDefaultRowHeight(theme, cellHeight);
  const styles = useStyles2(getStyles2, {
    enablePagination: props.enablePagination,
    noHeader: props.noHeader,
    defaultRowHeight,
  });
  const panelContext = usePanelContext();

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

  const rows = useMemo(() => frameToRecords(data), [data]);
  const {
    renderedRows,
    numRows,
    filter,
    setFilter,
    crossFilterOrder,
    crossFilterRows,
    sortColumns,
    setSortColumns,
    page,
    setPage,
    numPages,
    pageRangeStart,
    pageRangeEnd,
    smallPagination,
    footerCalcs,
  } = useProcessedRows(rows, data.fields, {
    height,
    width,
    initialSortBy,
    enablePagination,
    paginationHeight,
    hasHeader,
    hasFooter,
    defaultRowHeight,
    footerOptions,
    isCountRowsSet,
  });

  // const [expandedRows]?

  // const [scrollPos, setScrollPos] = useState(0);

  // vt scrollbar accounting for column auto-sizing
  const scrollbarWidth = useScrollbarWidth(gridHandle, props, renderedRows);

  // TODO: skip hidden
  const columns = useMemo<TableColumn[]>((): TableColumn[] => {
    const widths = computeColWidths(data.fields, width - scrollbarWidth);
    return data.fields.map((field, i): TableColumn => {
      const justifyColumnContent = getTextAlign(field);
      const footerStyles = getFooterStyles(justifyColumnContent);
      return {
        field,
        key: field.name,
        name: field.name,
        width: widths[i],
        headerCellClass: field.type === FieldType.number ? styles.cellRight : null,
        cellClass:
          field.type === FieldType.number
            ? styles.cellRight
            : () => {
                const cellType = field.config?.custom?.cellOptions?.type ?? TableCellDisplayMode.Auto;

                switch (cellType) {
                  case TableCellDisplayMode.Auto:
                  case TableCellDisplayMode.ColorBackground:
                  case TableCellDisplayMode.ColorBackgroundSolid:
                  case TableCellDisplayMode.ColorText:
                    return field.config.custom?.cellOptions.wrapText ? styles.cellWrapped : styles.cellText;
                  default:
                    return null;
                }
              },
        renderHeaderCell: ({ column, sortDirection }): JSX.Element => (
          <HeaderCell
            column={column}
            rows={rows}
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
    width,
    scrollbarWidth,
    rows,
    onColumnResize,
    data.fields,
    styles,
    showTypeIcons,
    filter,
    setFilter,
    sortColumns,
    setSortColumns,
    crossFilterOrder,
    crossFilterRows,
    onSortByChange,
    footerCalcs,
    isCountRowsSet,
  ]);

  const hasSubTable = false;

  // todo: don't re-init this on each memoizedData change, only schema/config changes
  const rowHeight = useRowHeight(columns, data, hasSubTable, defaultRowHeight);

  // we need to have variables with these exact names for the localization to work properly
  const itemsRangeStart = pageRangeStart;
  const displayedEnd = pageRangeEnd;

  return (
    <>
      <DataGrid<TableRow, TableSummaryRow>
        className={styles.grid}
        ref={gridHandle}
        columns={columns}
        rows={renderedRows}
        defaultColumnOptions={{
          minWidth: 50,
          resizable: true,
          sortable: true,
          // draggable: true,
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

  return (
    <Row
      key={key}
      {...props}
      onMouseEnter={() => onRowHover(rowIdx, panelContext, data, enableSharedCrosshair)}
      onMouseLeave={() => onRowLeave(panelContext, enableSharedCrosshair)}
    />
  );
}

export function onRowHover(idx: number, panelContext: PanelContext, frame: DataFrame, enableSharedCrosshair: boolean) {
  if (!enableSharedCrosshair) {
    return;
  }

  const timeField: Field = frame!.fields.find((f) => f.type === FieldType.time)!;

  if (!timeField) {
    return;
  }

  panelContext.eventBus.publish(
    new DataHoverEvent({
      point: {
        time: timeField.values[idx],
      },
    })
  );
}

export function onRowLeave(panelContext: PanelContext, enableSharedCrosshair: boolean) {
  if (!enableSharedCrosshair) {
    return;
  }

  panelContext.eventBus.publish(new DataHoverClearEvent());
}

const getStyles2 = (
  theme: GrafanaTheme2,
  {
    enablePagination,
    noHeader,
    defaultRowHeight,
  }: { enablePagination?: boolean; noHeader?: boolean; defaultRowHeight?: number }
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
      paddingInline: 6,
      paddingBlock: 6,

      // clip the overflow (like OG), without this the default is ellipsis
      textOverflow: 'initial',

      '&:last-child': {
        borderInlineEnd: 'none',
      },
    },

    '.rdg-header-row': {
      fontWeight: 'normal',

      '.rdg-cell': {
        borderInlineEnd: 'none',
      },
    },
  }),
  cellText: css({
    '&:hover': {
      position: 'absolute',
      width: '100%',
      whiteSpace: 'pre-line',
      zIndex: 1,

      // this prevents cells with empty content from collapsing to a few px
      minHeight: defaultRowHeight,
    },
  }),
  cellWrapped: css({
    whiteSpace: 'pre-line',
  }),
  cellRight: css({
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
  dataGridHeaderRow: css({
    paddingBlockStart: 0,
    ...(noHeader && { display: 'none' }),
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

/*
TODO:
styling
value formatting
footer reducers
hidden
auto-cell: can we deprecate in favor of newer RDG options?
overlay/expand on hover, active line and cell styling
inspect? actions?
subtable/ expand
cell types, backgrounds
-----
enable pagination disables footer?
-----
accessible sorting and filtering
*/
