import 'react-data-grid/lib/styles.css';
import { css } from '@emotion/css';
import { useMemo, useState, useLayoutEffect, useCallback, useRef, useEffect } from 'react';
import DataGrid, { RenderCellProps, RenderRowProps, Row, SortColumn, DataGridHandle } from 'react-data-grid';
import { useMeasure } from 'react-use';

import {
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  Field,
  fieldReducers,
  FieldType,
  formattedValueToString,
  getDefaultTimeRange,
  GrafanaTheme2,
  ReducerID,
} from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../themes';
import { t, Trans } from '../../../utils/i18n';
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
  TableNGProps,
  FilterType,
  TableRow,
  TableSummaryRow,
  ColumnTypes,
  TableColumnResizeActionCallback,
  TableColumn,
  TableFieldOptionsType,
  ScrollPosition,
  CellColors,
} from './types';
import {
  frameToRecords,
  getCellColors,
  getCellHeightCalculator,
  getComparator,
  getDefaultRowHeight,
  getFooterItemNG,
  getFooterStyles,
  getIsNestedTable,
  getRowHeight,
  getTextAlign,
  handleSort,
  MapFrameToGridOptions,
  shouldTextOverflow,
} from './utils';

export function TableNG(props: TableNGProps) {
  const {
    cellHeight,
    enablePagination,
    enableVirtualization = true,
    fieldConfig,
    footerOptions,
    height,
    initialSortBy,
    noHeader,
    onCellFilterAdded,
    onColumnResize,
    onSortByChange,
    width,
    data,
    enableSharedCrosshair,
    showTypeIcons,
  } = props;

  const initialSortColumns = useMemo<SortColumn[]>(() => {
    const initialSort = initialSortBy?.map(({ displayName, desc }) => {
      const matchingField = data.fields.find(({ state }) => state?.displayName === displayName);
      const columnKey = matchingField?.name || displayName;

      return {
        columnKey,
        direction: desc ? ('DESC' as const) : ('ASC' as const),
      };
    });
    return initialSort ?? [];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------- Local state ------------------------------ */
  const [revId, setRevId] = useState(0);
  const [contextMenuProps, setContextMenuProps] = useState<{
    rowIdx?: number;
    value: string;
    mode?: TableCellInspectorMode.code | TableCellInspectorMode.text;
    top?: number;
    left?: number;
  } | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>({});
  const [page, setPage] = useState(0);
  // This state will trigger re-render for recalculating row heights
  const [, setResizeTrigger] = useState(0);
  const [, setReadyForRowHeightCalc] = useState(false);
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>(initialSortColumns);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [isNestedTable, setIsNestedTable] = useState(false);
  const scrollPositionRef = useRef<ScrollPosition>({ x: 0, y: 0 });
  const [hasScroll, setHasScroll] = useState(false);

  /* ------------------------------- Local refs ------------------------------- */
  const crossFilterOrder = useRef<string[]>([]);
  const crossFilterRows = useRef<Record<string, TableRow[]>>({});
  const headerCellRefs = useRef<Record<string, HTMLDivElement>>({});
  // TODO: This ref persists sortColumns between renders. setSortColumns is still used to trigger re-render
  const sortColumnsRef = useRef<SortColumn[]>(initialSortColumns);
  const prevProps = useRef(props);
  const calcsRef = useRef<string[]>([]);
  const [paginationWrapperRef, { height: paginationHeight }] = useMeasure<HTMLDivElement>();

  const theme = useTheme2();
  const panelContext = usePanelContext();

  const isFooterVisible = Boolean(footerOptions?.show && footerOptions.reducer?.length);
  const isCountRowsSet = Boolean(
    footerOptions?.countRows &&
      footerOptions.reducer &&
      footerOptions.reducer.length &&
      footerOptions.reducer[0] === ReducerID.count
  );
  const tableRef = useRef<DataGridHandle | null>(null);

  /* --------------------------------- Effects -------------------------------- */
  useEffect(() => {
    // TODO: there is a use case when adding a new column to the table doesn't update the table
    if (
      prevProps.current.data.fields.length !== props.data.fields.length ||
      prevProps.current.fieldConfig?.overrides !== fieldConfig?.overrides ||
      prevProps.current.fieldConfig?.defaults !== fieldConfig?.defaults
    ) {
      setRevId(revId + 1);
    }
    prevProps.current = props;
  }, [props, revId, fieldConfig?.overrides, fieldConfig?.defaults]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!isContextMenuOpen) {
      return;
    }

    function onClick(event: MouseEvent) {
      setIsContextMenuOpen(false);
    }

    addEventListener('click', onClick);

    return () => {
      removeEventListener('click', onClick);
    };
  }, [isContextMenuOpen]);

  useEffect(() => {
    const hasNestedFrames = getIsNestedTable(props.data);
    setIsNestedTable(hasNestedFrames);
  }, [props.data]);

  useEffect(() => {
    const el = tableRef.current;
    if (el) {
      const gridElement = el?.element;
      if (gridElement) {
        setHasScroll(
          gridElement.scrollHeight > gridElement.clientHeight || gridElement.scrollWidth > gridElement.clientWidth
        );
      }
    }
  }, []);

  // TODO: this is a hack to force the column width to update when the fieldConfig changes
  const columnWidth = useMemo(() => {
    setRevId(revId + 1);
    return fieldConfig?.defaults?.custom?.width || 'auto';
  }, [fieldConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultRowHeight = getDefaultRowHeight(theme, cellHeight);
  const defaultLineHeight = theme.typography.body.lineHeight * theme.typography.fontSize;
  const panelPaddingHeight = theme.components.panel.padding * theme.spacing.gridSize * 2;

  /* ------------------------------ Rows & Columns ----------------------------- */
  const rows = useMemo(() => frameToRecords(props.data), [frameToRecords, props.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create a map of column key to column type
  const columnTypes = useMemo(
    () => props.data.fields.reduce((acc, { name, type }) => ({ ...acc, [name]: type }), {} as ColumnTypes),
    [props.data.fields]
  );

  // Create a map of column key to text wrap
  const textWraps = useMemo(
    () =>
      props.data.fields.reduce(
        (acc, { name, config }) => ({ ...acc, [name]: config?.custom?.cellOptions?.wrapText ?? false }),
        {} as { [key: string]: boolean }
      ),
    [props.data.fields]
  );

  const textWrap = useMemo(() => Object.values(textWraps).some(Boolean), [textWraps]);
  const styles = useStyles2(getStyles);

  // Create a function to get column widths for text wrapping calculations
  const getColumnWidths = useCallback(() => {
    const widths: Record<string, number> = {};

    // Set default widths from field config if they exist
    props.data.fields.forEach(({ name, config }) => {
      const configWidth = config?.custom?.width;
      const totalWidth = typeof configWidth === 'number' ? configWidth : COLUMN.DEFAULT_WIDTH;
      // subtract out padding and 1px right border
      const contentWidth = totalWidth - 2 * TABLE.CELL_PADDING - 1;
      widths[name] = contentWidth;
    });

    // Measure actual widths if available
    Object.keys(headerCellRefs.current).forEach((key) => {
      const headerCell = headerCellRefs.current[key];

      if (headerCell.offsetWidth > 0) {
        widths[key] = headerCell.offsetWidth;
      }
    });

    return widths;
  }, [props.data.fields]);

  const headersLength = useMemo(() => {
    return props.data.fields.length;
  }, [props.data.fields]);

  const fieldDisplayType = useMemo(() => {
    return props.data.fields.reduce(
      (acc, { config, name }) => {
        if (config?.custom?.cellOptions?.type) {
          acc[name] = config.custom.cellOptions.type;
        }
        return acc;
      },
      {} as Record<string, TableCellDisplayMode>
    );
  }, [props.data.fields]);

  // Clean up fieldsData to simplify
  const fieldsData = useMemo(
    () => ({
      headersLength,
      textWraps,
      columnTypes,
      fieldDisplayType,
      columnWidths: getColumnWidths(),
    }),
    [textWraps, columnTypes, getColumnWidths, headersLength, fieldDisplayType]
  );

  const getDisplayedValue = (row: TableRow, key: string) => {
    const field = props.data.fields.find((field) => field.name === key)!;
    const displayedValue = formattedValueToString(field.display!(row[key]));
    return displayedValue;
  };

  // Filter rows
  const filteredRows = useMemo(() => {
    const filterValues = Object.entries(filter);
    if (filterValues.length === 0) {
      // reset cross filter order
      crossFilterOrder.current = [];
      return rows;
    }

    // Update crossFilterOrder
    const filterKeys = new Set(filterValues.map(([key]) => key));
    filterKeys.forEach((key) => {
      if (!crossFilterOrder.current.includes(key)) {
        // Each time a filter is added or removed, it is always a single filter.
        // When adding a new filter, it is always appended to the end, maintaining the order.
        crossFilterOrder.current.push(key);
      }
    });
    // Remove keys from crossFilterOrder that are no longer present in the current filter values
    crossFilterOrder.current = crossFilterOrder.current.filter((key) => filterKeys.has(key));

    // reset crossFilterRows
    crossFilterRows.current = {};

    return rows.filter((row) => {
      for (const [key, value] of filterValues) {
        const displayedValue = getDisplayedValue(row, key);
        if (!value.filteredSet.has(displayedValue)) {
          return false;
        }
        // collect rows for crossFilter
        if (!crossFilterRows.current[key]) {
          crossFilterRows.current[key] = [row];
        } else {
          crossFilterRows.current[key].push(row);
        }
      }
      return true;
    });
  }, [rows, filter, props.data.fields]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort rows
  const sortedRows = useMemo(() => {
    const comparators = sortColumns.map(({ columnKey }) => getComparator(columnTypes[columnKey]));
    const sortDirs = sortColumns.map(({ direction }) => (direction === 'ASC' ? 1 : -1));

    if (sortColumns.length === 0) {
      return filteredRows;
    }

    return filteredRows.slice().sort((a, b) => {
      let result = 0;
      let sortIndex = 0;

      for (const { columnKey } of sortColumns) {
        const compare = comparators[sortIndex];
        result = sortDirs[sortIndex] * compare(a[columnKey], b[columnKey]);

        if (result !== 0) {
          break;
        }

        sortIndex += 1;
      }

      return result;
    });
  }, [filteredRows, sortColumns, columnTypes]);

  // Paginated rows
  // TODO consolidate calculations into pagination wrapper component and only use when needed
  const numRows = sortedRows.length;
  // calculate number of rowsPerPage based on height stack
  let headerCellHeight = TABLE.MAX_CELL_HEIGHT;
  if (noHeader) {
    headerCellHeight = 0;
  } else if (!noHeader && Object.keys(headerCellRefs.current).length > 0) {
    headerCellHeight = headerCellRefs.current[Object.keys(headerCellRefs.current)[0]].getBoundingClientRect().height;
  }
  let rowsPerPage = Math.floor(
    (height - headerCellHeight - TABLE.SCROLL_BAR_WIDTH - paginationHeight - panelPaddingHeight) / defaultRowHeight
  );
  // if footer calcs are on, remove one row per page
  if (isFooterVisible) {
    rowsPerPage -= 1;
  }
  if (rowsPerPage < 1) {
    // avoid 0 or negative rowsPerPage
    rowsPerPage = 1;
  }
  const numberOfPages = Math.ceil(numRows / rowsPerPage);
  if (page > numberOfPages) {
    // resets pagination to end
    setPage(numberOfPages - 1);
  }
  // calculate row range for pagination summary display
  const itemsRangeStart = page * rowsPerPage + 1;
  let displayedEnd = itemsRangeStart + rowsPerPage - 1;
  if (displayedEnd > numRows) {
    displayedEnd = numRows;
  }
  const smallPagination = width < TABLE.PAGINATION_LIMIT;

  const paginatedRows = useMemo(() => {
    const pageOffset = page * rowsPerPage;
    return sortedRows.slice(pageOffset, pageOffset + rowsPerPage);
  }, [rows, sortedRows, page, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useMemo(() => {
    calcsRef.current = props.data.fields.map((field, index) => {
      if (field.state?.calcs) {
        delete field.state?.calcs;
      }
      if (isCountRowsSet) {
        return index === 0 ? `${sortedRows.length}` : '';
      }
      if (index === 0) {
        const footerCalcReducer = footerOptions?.reducer?.[0];
        return footerCalcReducer ? fieldReducers.get(footerCalcReducer).name : '';
      }
      return getFooterItemNG(sortedRows, field, footerOptions);
    });
  }, [sortedRows, props.data.fields, footerOptions, isCountRowsSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCellExpand = (rowIdx: number) => {
    if (!expandedRows.includes(rowIdx)) {
      setExpandedRows([...expandedRows, rowIdx]);
    } else {
      const currentExpandedRows = expandedRows;
      const indexToRemove = currentExpandedRows.indexOf(rowIdx);
      if (indexToRemove > -1) {
        currentExpandedRows.splice(indexToRemove, 1);
        setExpandedRows(currentExpandedRows);
      }
    }
    setResizeTrigger((prev) => prev + 1);
  };

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

  const columns = useMemo(
    () =>
      mapFrameToDataGrid({
        frame: props.data,
        calcsRef,
        options: {
          columnTypes,
          textWraps,
          columnWidth,
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
          rows,
          // INFO: sortedRows is for correct row indexing for cell background coloring
          sortedRows,
          setContextMenuProps,
          setFilter,
          setIsInspecting,
          setSortColumns,
          sortColumnsRef,
          styles,
          theme,
          showTypeIcons,
          ...props,
        },
        handlers: {
          onCellExpand,
          onColumnResize: onColumnResize!,
        },
        // Adjust table width to account for the scroll bar width
        availableWidth: width - (hasScroll ? TABLE.SCROLL_BAR_WIDTH + TABLE.SCROLL_BAR_MARGIN : 0),
      }),
    [props.data, calcsRef, filter, expandedRows, expandedRows.length, footerOptions, width, hasScroll, sortedRows] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // This effect needed to set header cells refs before row height calculation
  useLayoutEffect(() => {
    setReadyForRowHeightCalc(Object.keys(headerCellRefs.current).length > 0);
  }, [columns]);

  const renderMenuItems = () => {
    return (
      <>
        <MenuItem
          label={t('grafana-ui.table.inspect-menu-label', 'Inspect value')}
          onClick={() => {
            setIsInspecting(true);
          }}
          className={styles.menuItem}
        />
      </>
    );
  };

  const cellHeightCalc = useMemo(() => {
    return getCellHeightCalculator(ctx, defaultLineHeight, defaultRowHeight, TABLE.CELL_PADDING);
  }, [ctx, defaultLineHeight, defaultRowHeight]);

  const calculateRowHeight = useCallback(
    (row: TableRow) => {
      // Logic for sub-tables
      if (Number(row.__depth) === 1 && !expandedRows.includes(Number(row.__index))) {
        return 0;
      } else if (Number(row.__depth) === 1 && expandedRows.includes(Number(row.__index))) {
        const headerCount = row?.data?.meta?.custom?.noHeader ? 0 : 1;
        return defaultRowHeight * (row.data?.length ?? 0 + headerCount); // TODO this probably isn't very robust
      }
      return getRowHeight(row, cellHeightCalc, avgCharWidth, defaultRowHeight, fieldsData);
    },
    [expandedRows, avgCharWidth, defaultRowHeight, fieldsData, cellHeightCalc]
  );

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    scrollPositionRef.current = {
      x: target.scrollLeft,
      y: target.scrollTop,
    };
  };

  // Reset sortColumns when initialSortBy changes
  useEffect(() => {
    if (initialSortColumns.length > 0) {
      setSortColumns(initialSortColumns);
    }
  }, [initialSortColumns]);

  // Restore scroll position after re-renders
  useEffect(() => {
    if (tableRef.current?.element) {
      tableRef.current.element.scrollLeft = scrollPositionRef.current.x;
      tableRef.current.element.scrollTop = scrollPositionRef.current.y;
    }
  }, [revId]);

  return (
    <>
      <DataGrid<TableRow, TableSummaryRow>
        ref={tableRef}
        className={styles.dataGrid}
        // Default to true, overridden to false for testing
        enableVirtualization={enableVirtualization}
        key={`DataGrid${revId}`}
        rows={enablePagination ? paginatedRows : sortedRows}
        columns={columns}
        headerRowHeight={noHeader ? 0 : undefined}
        defaultColumnOptions={{
          sortable: true,
          resizable: true,
        }}
        rowHeight={textWrap || isNestedTable ? calculateRowHeight : defaultRowHeight}
        // TODO: This doesn't follow current table behavior
        style={{ width, height: height - (enablePagination ? paginationHeight : 0) }}
        renderers={{
          renderRow: (key, props) =>
            myRowRenderer(key, props, expandedRows, panelContext, data, enableSharedCrosshair ?? false),
        }}
        onScroll={handleScroll}
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
        // sorting
        sortColumns={sortColumns}
        // footer
        // TODO figure out exactly how this works - some array needs to be here for it to render regardless of renderSummaryCell()
        bottomSummaryRows={isFooterVisible ? [{}] : undefined}
        onColumnResize={() => {
          // NOTE: This method is called continuously during the column resize drag operation,
          // providing the current column width. There is no separate event for the end of the drag operation.
          if (textWrap) {
            // This is needed only when textWrap is enabled
            // TODO: this is a hack to force rowHeight re-calculation
            setResizeTrigger((prev) => prev + 1);
          }
        }}
      />

      {enablePagination && (
        <div className={styles.paginationContainer} ref={paginationWrapperRef}>
          <Pagination
            className="table-ng-pagination"
            currentPage={page + 1}
            numberOfPages={numberOfPages}
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

      {isContextMenuOpen && (
        <ContextMenu
          x={contextMenuProps?.left || 0}
          y={contextMenuProps?.top || 0}
          renderMenuItems={renderMenuItems}
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
    rows,
    sortedRows,
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
  const hasNestedFrames = getIsNestedTable(frame);

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
        const display = field.display!(field.values.get(sortedRows[rowIndex].__index));
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
            rowIdx={sortedRows[rowIdx].__index}
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

const getStyles = (theme: GrafanaTheme2) => ({
  dataGrid: css({
    '--rdg-background-color': theme.colors.background.primary,
    '--rdg-header-background-color': theme.colors.background.primary,
    '--rdg-border-color': 'transparent',
    '--rdg-color': theme.colors.text.primary,
    '&:hover': {
      '--rdg-row-hover-background-color': theme.colors.emphasize(theme.colors.action.hover, 0.6),
    },

    // If we rely solely on borderInlineEnd which is added from data grid, we
    // get a small gap where the gridCell borders meet the column header borders.
    // To avoid this, we can unset borderInlineEnd and set borderRight instead.
    '.rdg-cell': {
      borderInlineEnd: 'unset',
      borderRight: `1px solid ${theme.colors.border.medium}`,

      '&:last-child': {
        borderRight: 'none',
      },
    },

    '.rdg-summary-row': {
      backgroundColor: theme.colors.background.primary,
      '--rdg-summary-border-color': theme.colors.border.medium,

      '.rdg-cell': {
        borderRight: 'none',
      },
    },

    // Due to stylistic choices, we do not want borders on the column headers
    // other than the bottom border.
    'div[role=columnheader]': {
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      borderInlineEnd: 'unset',

      '.r1y6ywlx7-0-0-beta-46': {
        '&:hover': {
          borderRight: `3px solid ${theme.colors.text.link}`,
        },
      },
    },

    '::-webkit-scrollbar': {
      width: TABLE.SCROLL_BAR_WIDTH,
      height: TABLE.SCROLL_BAR_WIDTH,
    },
    '::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(204, 204, 220, 0.16)',
      borderRadius: '4px',
    },
    '::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '::-webkit-scrollbar-corner': {
      backgroundColor: 'transparent',
    },
  }),
  menuItem: css({
    maxWidth: '200px',
  }),
  cell: css({
    '--rdg-border-color': theme.colors.border.medium,
    borderLeft: 'none',
    whiteSpace: 'nowrap',
    wordWrap: 'break-word',
    overflow: 'hidden',
    textOverflow: 'ellipsis',

    // Reset default cell styles for custom cell component styling
    paddingInline: '0',
  }),
  cellWrapped: css({
    '--rdg-border-color': theme.colors.border.medium,
    borderLeft: 'none',
    whiteSpace: 'pre-line',
    wordWrap: 'break-word',
    overflow: 'hidden',
    textOverflow: 'ellipsis',

    // Reset default cell styles for custom cell component styling
    paddingInline: '0',
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
});
