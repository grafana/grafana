import 'react-data-grid/lib/styles.css';
import { css } from '@emotion/css';
import {
  useMemo,
  useState,
  useLayoutEffect,
  // useCallback,
  useRef,
  // useEffect,
  // Dispatch,
  // SetStateAction,
  RefObject,
} from 'react';
import { DataGrid, RenderCellProps, RenderRowProps, Row, /* SortColumn, */ DataGridHandle } from 'react-data-grid';
// import { useMeasure } from 'react-use';

import {
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  Field,
  // fieldReducers,
  FieldType,
  // formattedValueToString,
  getDefaultTimeRange,
  GrafanaTheme2,
  // ReducerID,
} from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../themes';
import { /* t, */ Trans } from '../../../utils/i18n';
// import { ContextMenu } from '../../ContextMenu/ContextMenu';
// import { MenuItem } from '../../Menu/MenuItem';
// import { Pagination } from '../../Pagination/Pagination';
import { PanelContext /* , usePanelContext */, usePanelContext } from '../../PanelChrome';
// import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';

import { HeaderCell } from './Cells/HeaderCell';
import { RowExpander } from './Cells/RowExpander';
import { TableCellNG } from './Cells/TableCellNG';
import { COLUMN, TABLE } from './constants';
import { useTableFiltersAndSorts } from './hooks';
import {
  TableNGProps,
  // FilterType,
  TableRow,
  TableSummaryRow,
  // ColumnTypes,
  TableColumnResizeActionCallback,
  TableColumn,
  TableFieldOptionsType,
  // ScrollPosition,
  CellColors,
} from './types';
import {
  frameToRecords,
  getCellColors,
  getCellHeightCalculator,
  // getComparator,
  // getDefaultRowHeight,
  // getFooterItemNG,
  getFooterStyles,
  getIsNestedTable,
  // getRowHeight,
  getTextAlign,
  handleSort,
  MapFrameToGridOptions,
  shouldTextOverflow,
} from './utils';

export function TableNG(props: TableNGProps) {
  const styles = useStyles2(getStyles2);
  const panelContext = usePanelContext();

  const { data, onColumnResize, width } = props;
  const gridHandle = useRef<DataGridHandle>(null);
  const headerCellRefs = useRef<Record<string, HTMLDivElement>>({});

  // the data passed into this component is always a new reference after column resizing,
  // which leads to the memos in this component failing to work properly. we sinfully
  // memoize based on the array length here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // const memoizedData = useMemo(() => data, [data.length]);

  const rows = useMemo(() => frameToRecords(data), [data]);
  const { filter, setFilter, crossFilterOrder, crossFilterRows, renderedRows } = useTableFiltersAndSorts(
    rows,
    data.fields
  );

  // const [expandedRows]?

  // const [page, setPage] = useState(0);
  // const [scrollPos, setScrollPos] = useState(0);

  // vt scrollbar accounting for column auto-sizing
  const scrollbarWidth = useScrollbarWidth(gridHandle, props, renderedRows);

  // TODO: skip hidden
  const columns = useMemo<TableColumn[]>((): TableColumn[] => {
    const widths = computeColWidths(data.fields, width - scrollbarWidth);

    return data.fields.map(
      (field, i): TableColumn => ({
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
            onSort={() => {}}
            // onSort={(columnKey, direction, isMultiSort) => {
            //   handleSort(columnKey, direction, isMultiSort, setSortColumns, sortColumnsRef);

            //   // Update panel context with the new sort order
            //   if (onSortByChange) {
            //     const sortByFields = sortColumnsRef.current.map(({ columnKey, direction }) => ({
            //       displayName: columnKey,
            //       desc: direction === 'DESC',
            //     }));
            //     onSortByChange(sortByFields);
            //   }
            // }}
            filter={filter}
            setFilter={setFilter}
            crossFilterOrder={crossFilterOrder}
            crossFilterRows={crossFilterRows}
            direction={sortDirection}
            justifyContent={getTextAlign(field)}
            onColumnResize={onColumnResize}
            headerCellRefs={headerCellRefs}
            showTypeIcons={props.showTypeIcons}
          />
        ),
      })
    );
  }, [
    width,
    scrollbarWidth,
    rows,
    onColumnResize,
    data.fields,
    styles,
    props.showTypeIcons,
    filter,
    setFilter,
    crossFilterOrder,
    crossFilterRows,
  ]);

  const hasSubTable = false;

  // todo: don't re-init this on each memoizedData change, only schema/config changes
  const rowHeight = useRowHeight(columns, data, hasSubTable);

  return (
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
      rowHeight={rowHeight}
      renderers={{
        renderRow: (key, rowProps) =>
          myRowRenderer(key, rowProps, [], panelContext, data, props.enableSharedCrosshair ?? false),
      }}
    />
  );
}

export function mapFrameToDataGrid({
  frame,
  calcsRef,
  options,
  handlers,
  availableWidth,
}: {
  frame: DataFrame;
  calcsRef: React.MutableRefObject<string[]>;
  options: MapFrameToGridOptions;
  handlers: { onCellExpand: (rowIdx: number) => void; onColumnResize: TableColumnResizeActionCallback };
  availableWidth: number;
}): TableColumn[] {
  const {
    columnTypes,
    textWraps,
    crossFilterOrder,
    crossFilterRows,
    defaultLineHeight,
    defaultRowHeight,
    expandedRows,
    filter,
    headerCellRefs,
    isCountRowsSet,
    onCellFilterAdded,
    ctx,
    onSortByChange,
    renderedRows,
    rows,
    setContextMenuProps,
    setFilter,
    setIsInspecting,
    setSortColumns,
    sortColumnsRef,
    styles,
    theme,
    timeRange,
    getActions,
    showTypeIcons,
  } = options;
  const { onCellExpand, onColumnResize } = handlers;

  const columns: TableColumn[] = [];
  const hasNestedFrames = getIsNestedTable(frame.fields);

  // If nested frames, add expansion control column
  if (hasNestedFrames) {
    const expanderField: Field = {
      name: '',
      type: FieldType.other,
      config: {},
      values: [],
    };
    columns.push({
      key: 'expanded',
      name: '',
      field: expanderField,
      cellClass: styles.cell,
      colSpan(args) {
        return args.type === 'ROW' && Number(args.row.__depth) === 1 ? frame.fields.length : 1;
      },
      renderCell: ({ row }) => {
        // TODO add TableRow type extension to include row depth and optional data
        if (Number(row.__depth) === 0) {
          const rowIdx = Number(row.__index);
          return (
            <RowExpander
              height={defaultRowHeight}
              onCellExpand={() => onCellExpand(rowIdx)}
              isExpanded={expandedRows.includes(rowIdx)}
            />
          );
        }
        // If it's a child, render entire DataGrid at first column position
        let expandedColumns: TableColumn[] = [];
        let expandedRecords: TableRow[] = [];

        // Type guard to check if data exists as it's optional
        if (row.data) {
          expandedColumns = mapFrameToDataGrid({
            frame: row.data,
            calcsRef,
            options: { ...options },
            handlers: { onCellExpand, onColumnResize },
            availableWidth: availableWidth - COLUMN.EXPANDER_WIDTH,
          });
          expandedRecords = frameToRecords(row.data);
        }

        // TODO add renderHeaderCell HeaderCell's here and handle all features
        return (
          <DataGrid<TableRow, TableSummaryRow>
            className="rdg-dark"
            rows={expandedRecords}
            columns={expandedColumns}
            rowHeight={defaultRowHeight}
            style={{ height: '100%', overflow: 'visible', marginLeft: COLUMN.EXPANDER_WIDTH }}
            headerRowHeight={row.data?.meta?.custom?.noHeader ? 0 : undefined}
          />
        );
      },
      width: COLUMN.EXPANDER_WIDTH,
      minWidth: COLUMN.EXPANDER_WIDTH,
    });

    availableWidth -= COLUMN.EXPANDER_WIDTH;
  }

  // Row background color function
  let rowBg: Function | undefined = undefined;
  for (const field of frame.fields) {
    const fieldOptions = field.config.custom;
    const cellOptionsExist = fieldOptions !== undefined && fieldOptions.cellOptions !== undefined;

    if (
      cellOptionsExist &&
      fieldOptions.cellOptions.type === TableCellDisplayMode.ColorBackground &&
      fieldOptions.cellOptions.applyToRow
    ) {
      rowBg = (rowIndex: number): CellColors => {
        const display = field.display!(field.values.get(renderedRows[rowIndex].__index));
        const colors = getCellColors(theme, fieldOptions.cellOptions, display);
        return colors;
      };
    }
  }

  let fieldCountWithoutWidth = 0;
  frame.fields.map((field, fieldIndex) => {
    if (field.type === FieldType.nestedFrames || field.config.custom?.hidden) {
      // Don't render nestedFrames type field
      return;
    }
    const fieldTableOptions: TableFieldOptionsType = field.config.custom || {};
    const key = field.name;
    const justifyColumnContent = getTextAlign(field);
    const footerStyles = getFooterStyles(justifyColumnContent);

    // current/old table width logic calculations
    if (fieldTableOptions.width) {
      availableWidth -= fieldTableOptions.width;
    } else {
      fieldCountWithoutWidth++;
    }

    // Add a column for each field
    columns.push({
      key,
      name: field.name,
      field,
      cellClass: textWraps[field.name] ? styles.cellWrapped : styles.cell,
      renderCell: (props: RenderCellProps<TableRow, TableSummaryRow>): JSX.Element => {
        const { row, rowIdx } = props;
        const cellType = field.config?.custom?.cellOptions?.type ?? TableCellDisplayMode.Auto;
        const value = row[key];
        // Cell level rendering here
        return (
          <TableCellNG
            frame={frame}
            key={key}
            value={value}
            field={field}
            theme={theme}
            timeRange={timeRange ?? getDefaultTimeRange()}
            height={defaultRowHeight}
            justifyContent={justifyColumnContent}
            rowIdx={renderedRows[rowIdx].__index}
            shouldTextOverflow={() =>
              shouldTextOverflow(
                key,
                row,
                columnTypes,
                headerCellRefs,
                ctx,
                defaultLineHeight,
                defaultRowHeight,
                TABLE.CELL_PADDING,
                textWraps[field.name],
                field,
                cellType
              )
            }
            setIsInspecting={setIsInspecting}
            setContextMenuProps={setContextMenuProps}
            getActions={getActions}
            rowBg={rowBg}
            onCellFilterAdded={onCellFilterAdded}
          />
        );
      },
      renderSummaryCell: () => {
        if (isCountRowsSet && fieldIndex === 0) {
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                <Trans i18nKey="grafana-ui.table.count">Count</Trans>
              </span>
              <span>{calcsRef.current[fieldIndex]}</span>
            </div>
          );
        }
        return <div className={footerStyles.footerCell}>{calcsRef.current[fieldIndex]}</div>;
      },
      renderHeaderCell: ({ column, sortDirection }): JSX.Element => (
        <HeaderCell
          column={column}
          rows={rows}
          field={field}
          onSort={(columnKey, direction, isMultiSort) => {
            handleSort(columnKey, direction, isMultiSort, setSortColumns, sortColumnsRef);

            // Update panel context with the new sort order
            if (onSortByChange) {
              const sortByFields = sortColumnsRef.current.map(({ columnKey, direction }) => ({
                displayName: columnKey,
                desc: direction === 'DESC',
              }));
              onSortByChange(sortByFields);
            }
          }}
          direction={sortDirection}
          justifyContent={justifyColumnContent}
          filter={filter}
          setFilter={setFilter}
          onColumnResize={onColumnResize}
          headerCellRefs={headerCellRefs}
          crossFilterOrder={crossFilterOrder}
          crossFilterRows={crossFilterRows}
          showTypeIcons={showTypeIcons}
        />
      ),
      width: fieldTableOptions.width,
      minWidth: fieldTableOptions.minWidth || COLUMN.DEFAULT_WIDTH,
    });
  });

  // INFO: This loop calculates the width for each column in less than a millisecond.
  let sharedWidth = availableWidth / fieldCountWithoutWidth;

  // First pass: Assign minimum widths to columns that need it
  columns.forEach((column) => {
    if (!column.width && column.minWidth! > sharedWidth) {
      column.width = column.minWidth;
      availableWidth -= column.width!;
      fieldCountWithoutWidth -= 1;
    }
  });

  // Recalculate shared width after assigning minimum widths
  sharedWidth = availableWidth / fieldCountWithoutWidth;

  // Second pass: Assign shared width to remaining columns
  columns.forEach((column) => {
    if (!column.width) {
      column.width = sharedWidth;
    }
    column.minWidth = COLUMN.MIN_WIDTH; // Ensure min-width is always set
  });

  return columns;
}

export function myRowRenderer(
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

const getStyles2 = (theme: GrafanaTheme2) => ({
  grid: css({
    '--rdg-background-color': theme.colors.background.primary,
    '--rdg-header-background-color': theme.colors.background.primary,
    '--rdg-border-color': theme.isDark ? '#282b30' : '#ebebec',
    '--rdg-color': theme.colors.text.primary,

    // note: this cannot have any transparency since default cells that
    // overlay/overflow on hover inherit this background and need to occlude cells below
    '--rdg-row-hover-background-color': theme.isDark ? '#212428' : '#f4f5f5',

    blockSize: '100%',
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
      minHeight: 35, // defaultRowHeight
    },
  }),
  cellWrapped: css({
    whiteSpace: 'pre-line',
  }),
  cellRight: css({
    textAlign: 'right',
  }),
});

// const getStyles = (theme: GrafanaTheme2) => ({
//   dataGrid: css({
//     '--rdg-background-color': theme.colors.background.primary,
//     '--rdg-header-background-color': theme.colors.background.primary,
//     '--rdg-border-color': 'transparent',
//     '--rdg-color': theme.colors.text.primary,
//     '--rdg-row-hover-background-color': theme.colors.emphasize(theme.colors.action.hover, 0.6),

//     // If we rely solely on borderInlineEnd which is added from data grid, we
//     // get a small gap where the gridCell borders meet the column header borders.
//     // To avoid this, we can unset borderInlineEnd and set borderRight instead.
//     '.rdg-cell': {
//       borderInlineEnd: 'unset',
//       borderRight: `1px solid ${theme.colors.border.medium}`,

//       '&:last-child': {
//         borderRight: 'none',
//       },
//     },

//     '.rdg-summary-row': {
//       backgroundColor: theme.colors.background.primary,
//       '--rdg-summary-border-color': theme.colors.border.medium,

//       '.rdg-cell': {
//         borderRight: 'none',
//       },
//     },

//     // Due to stylistic choices, we do not want borders on the column headers
//     // other than the bottom border.
//     'div[role=columnheader]': {
//       borderBottom: `1px solid ${theme.colors.border.medium}`,
//       borderInlineEnd: 'unset',

//       '.r1y6ywlx7-0-0-beta-46': {
//         '&:hover': {
//           borderRight: `3px solid ${theme.colors.text.link}`,
//         },
//       },
//     },

//     '::-webkit-scrollbar': {
//       width: TABLE.SCROLL_BAR_WIDTH,
//       height: TABLE.SCROLL_BAR_WIDTH,
//     },
//     '::-webkit-scrollbar-thumb': {
//       backgroundColor: 'rgba(204, 204, 220, 0.16)',
//       // eslint-disable-next-line @grafana/no-border-radius-literal
//       borderRadius: '4px',
//     },
//     '::-webkit-scrollbar-track': {
//       background: 'transparent',
//     },
//     '::-webkit-scrollbar-corner': {
//       backgroundColor: 'transparent',
//     },
//   }),
//   menuItem: css({
//     maxWidth: '200px',
//   }),
//   cell: css({
//     '--rdg-border-color': theme.colors.border.medium,
//     borderLeft: 'none',
//     whiteSpace: 'nowrap',
//     wordWrap: 'break-word',
//     overflow: 'hidden',
//     textOverflow: 'ellipsis',

//     // Reset default cell styles for custom cell component styling
//     paddingInline: '0',
//   }),
//   cellWrapped: css({
//     '--rdg-border-color': theme.colors.border.medium,
//     borderLeft: 'none',
//     whiteSpace: 'pre-line',
//     wordWrap: 'break-word',
//     overflow: 'hidden',
//     textOverflow: 'ellipsis',

//     // Reset default cell styles for custom cell component styling
//     paddingInline: '0',
//   }),
//   paginationContainer: css({
//     alignItems: 'center',
//     display: 'flex',
//     justifyContent: 'center',
//     marginTop: '8px',
//     width: '100%',
//   }),
//   paginationSummary: css({
//     color: theme.colors.text.secondary,
//     fontSize: theme.typography.bodySmall.fontSize,
//     display: 'flex',
//     justifyContent: 'flex-end',
//     padding: theme.spacing(0, 1, 0, 2),
//   }),
// });

// interface ColResizeState {
//   idx: number;
//   width: number;
// }

// type OnColResizeDone = (idx: number, width: number) => void;

// const useColumnResizeDone = (done: OnColResizeDone) => {
//   const colResizeState = useMemo<ColResizeState>(() => ({ idx: -1, width: 0 }), []);

//   const finished = useCallback(() => {
//     done(colResizeState.idx, colResizeState.width);

//     window.removeEventListener('click', finished, { capture: true });
//     colResizeState.idx = -1;
//     colResizeState.width = 0;
//   }, [colResizeState, done]);

//   const onColumnResize = useCallback((idx: number, width: number) => {
//     if (colResizeState.idx === -1) {
//       window.addEventListener('click', finished, { capture: true });
//     }

//     colResizeState.idx = idx;
//     colResizeState.width = width;
//   }, [colResizeState, finished]);

//   return onColumnResize;
// };

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

function useScrollbarWidth(ref: RefObject<DataGridHandle>, { height }: TableNGProps, renderedRows: TableRow[]) {
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useLayoutEffect(
    () => {
      let el = ref.current!.element!;
      setScrollbarWidth(el.offsetWidth - el.clientWidth);
    },
    // todo: account for pagination, subtable expansion, default row height changes, height changes, data length
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [height, renderedRows]
  );

  return scrollbarWidth;
}

const useRowHeight = (columns: TableColumn[], data: DataFrame, hasSubTable: boolean) => {
  const theme = useTheme2();

  const wrappedColIdxs = useMemo(
    () =>
      data.fields.map((field) => {
        if (field.type === FieldType.string) {
          const { wrapText = false, type = TableCellDisplayMode.Auto } = field.config.custom?.cellOptions ?? {};
          return wrapText && type !== TableCellDisplayMode.Image;
        }
        return false;
      }),
    [data]
  );

  const { ctx, avgCharWidth } = useMemo(() => {
    const font = `${theme.typography.fontSize}px ${theme.typography.fontFamily}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    // set in grafana/data in createTypography.ts
    const letterSpacing = 0.15;

    ctx.letterSpacing = `${letterSpacing}px`;
    ctx.font = font;
    let txt =
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s";
    const txtWidth = ctx.measureText(txt).width;
    const avgCharWidth = txtWidth / txt.length + letterSpacing;

    return {
      ctx,
      font,
      avgCharWidth,
    };
  }, [theme.typography.fontSize, theme.typography.fontFamily]);

  const rowHeight = useMemo(() => {
    const defaultRowHeight = 35;

    if (hasSubTable || wrappedColIdxs.some((v) => v)) {
      const HPADDING = 6;
      const BORDER_RIGHT = 0.666667;
      const lineHeight = 22;
      const VPADDING = 6;

      const wrapWidths = columns.map((c) => Number(c.width) - 2 * HPADDING - BORDER_RIGHT);

      // TODO: pass line height, row height, padding here
      const calc = getCellHeightCalculator(ctx, lineHeight, defaultRowHeight, VPADDING);

      const getRowHeight = ({ __index: rowIdx }: TableRow) => {
        let maxLines = 1;
        let maxLinesIdx = -1;
        let maxLinesText = '';

        for (let i = 0; i < columns.length; i++) {
          if (wrappedColIdxs[i]) {
            const cellText = String(columns[i].field.values[rowIdx]);

            if (cellText != null) {
              const charsPerLine = wrapWidths[i] / avgCharWidth;
              const approxLines = cellText.length / charsPerLine;

              if (approxLines > maxLines) {
                maxLines = approxLines;
                maxLinesIdx = i;
                maxLinesText = cellText;
              }
            }
          }
        }

        return maxLinesIdx === -1 ? defaultRowHeight : calc(maxLinesText, wrapWidths[maxLinesIdx]);
      };

      return getRowHeight;
    }

    return defaultRowHeight;
  }, [wrappedColIdxs, hasSubTable, columns, avgCharWidth, ctx]);

  return rowHeight;
};

/*
TODO:

styling
value formatting
sorting
filtering
footer reducers
hidden
overlay/expand on hover, active line and cell styling
inspect? actions?
subtable/ expand
cell types, backgrounds
*/
