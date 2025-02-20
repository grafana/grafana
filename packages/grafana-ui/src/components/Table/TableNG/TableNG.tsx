import 'react-data-grid/lib/styles.css';
import { css } from '@emotion/css';
import { Property } from 'csstype';
import React, { useMemo, useState, useLayoutEffect, useCallback, useRef, useEffect } from 'react';
import DataGrid, { Column, RenderRowProps, Row, SortColumn, SortDirection } from 'react-data-grid';
import { useMeasure } from 'react-use';

import {
  DataFrame,
  Field,
  fieldReducers,
  FieldType,
  formattedValueToString,
  GrafanaTheme2,
  ReducerID,
} from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';
import { getScrollbarWidth, Pagination } from '@grafana/ui';

import { useStyles2, useTheme2 } from '../../../themes';
import { Trans } from '../../../utils/i18n';
import { ContextMenu } from '../../ContextMenu/ContextMenu';
import { MenuItem } from '../../Menu/MenuItem';
import { ScrollContainer } from '../../ScrollContainer/ScrollContainer';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { TableNGProps } from '../types';
import { getTextAlign } from '../utils';

import { HeaderCell } from './Cells/HeaderCell';
import { RowExpander } from './Cells/RowExpander';
import { TableCellNG } from './Cells/TableCellNG';
import { getRowHeight, shouldTextOverflow, getFooterItemNG } from './utils';

const DEFAULT_CELL_PADDING = 6;
const COLUMN_MIN_WIDTH = 150;
const EXPANDER_WIDTH = 50;
const SMALL_PAGINATION_LIMIT = 750;
const MAX_CELL_HEIGHT = 48;
const SCROLL_BAR_WIDTH = getScrollbarWidth();

type TableRow = Record<string, unknown>;

interface TableColumn extends Column<TableRow> {
  key: string;
  name: string;
  field: Field;
}

export type FilterType = {
  [key: string]: {
    filteredSet: Set<string>;
  };
};

/**
 * getIsNestedTable is a helper function that takes a DataFrame and returns a
 * boolean value based on the presence of nested frames
 */
const getIsNestedTable = (dataFrame: DataFrame): boolean =>
  dataFrame.fields.some(({ type }) => type === FieldType.nestedFrames);

export function TableNG(props: TableNGProps) {
  const {
    height,
    width,
    timeRange,
    cellHeight,
    noHeader,
    fieldConfig,
    footerOptions,
    onColumnResize,
    enablePagination,
    getActions,
  } = props;

  const textWrap = fieldConfig?.defaults?.custom?.cellOptions.wrapText ?? false;
  const cellInspect = fieldConfig?.defaults?.custom?.inspect ?? false;
  const filterable = fieldConfig?.defaults?.custom?.filterable ?? false;

  const theme = useTheme2();
  const styles = useStyles2(getStyles, textWrap);

  const isFooterVisible = Boolean(footerOptions?.show && footerOptions.reducer.length);
  const isCountRowsSet = Boolean(
    footerOptions?.countRows &&
      footerOptions.reducer &&
      footerOptions.reducer.length &&
      footerOptions.reducer[0] === ReducerID.count
  );

  // TODO: this is a hack to force the column width to update when the fieldConfig changes
  const [revId, setRevId] = useState(0);
  const columnWidth = useMemo(() => {
    setRevId(revId + 1);
    return fieldConfig?.defaults?.custom?.width || 'auto';
  }, [fieldConfig]); // eslint-disable-line react-hooks/exhaustive-deps
  const columnMinWidth = fieldConfig?.defaults?.custom?.minWidth || COLUMN_MIN_WIDTH;

  const prevProps = useRef(props);
  useEffect(() => {
    // TODO: there is a usecase when adding a new column to the table doesn't update the table
    if (prevProps.current.data.fields.length !== props.data.fields.length) {
      setRevId(revId + 1);
    }
    prevProps.current = props;
  }, [props.data]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const crossFilterOrder = useRef<string[]>([]);
  const crossFilterRows = useRef<{ [key: string]: TableRow[] }>({});

  const headerCellRefs = useRef<Record<string, HTMLDivElement>>({});
  const [, setReadyForRowHeightCalc] = useState(false);

  const [paginationWrapperRef, { height: paginationHeight }] = useMeasure<HTMLDivElement>();

  // This state will trigger re-render for recalculating row heights
  const [, setResizeTrigger] = useState(0);

  // Create off-screen canvas for measuring rows for virtualized rendering
  // This line is like this because Jest doesn't have OffscreenCanvas mocked
  // nor is it a part of the jest-canvas-mock package
  let osContext = null;
  if (window.OffscreenCanvas !== undefined) {
    // The canvas size is defined arbitrarily
    // As we never actually visualize rendered content
    // from the offscreen canvas, only perform text measurements
    osContext = new OffscreenCanvas(256, 1024).getContext('2d');
  }

  // Set font property using theme info
  // This will make text measurement accurate
  if (osContext !== undefined && osContext !== null) {
    osContext.font = `${theme.typography.fontSize}px ${theme.typography.body.fontFamily}`;
  }

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

  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);
  // TODO: this ref using to persist sortColumns between renders;
  // setSortColumns is still used to trigger re-render
  const sortColumnsRef = useRef(sortColumns);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [isNestedTable, setIsNestedTable] = useState(false);

  function getDefaultRowHeight(): number {
    const bodyFontSize = theme.typography.fontSize;
    const lineHeight = theme.typography.body.lineHeight;

    switch (cellHeight) {
      case TableCellHeight.Sm:
        return 36;
      case TableCellHeight.Md:
        return 42;
      case TableCellHeight.Lg:
        return MAX_CELL_HEIGHT;
    }

    return DEFAULT_CELL_PADDING * 2 + bodyFontSize * lineHeight;
  }
  const defaultRowHeight = getDefaultRowHeight();
  const defaultLineHeight = theme.typography.body.lineHeight * theme.typography.fontSize;

  const handleSort = (columnKey: string, direction: SortDirection, isMultiSort: boolean) => {
    let currentSortColumn: SortColumn | undefined;

    const updatedSortColumns = sortColumnsRef.current.filter((column) => {
      const isCurrentColumn = column.columnKey === columnKey;
      if (isCurrentColumn) {
        currentSortColumn = column;
      }
      return !isCurrentColumn;
    });

    // sorted column exists and is descending -> remove it to reset sorting
    if (currentSortColumn && currentSortColumn.direction === 'DESC') {
      setSortColumns(updatedSortColumns);
      sortColumnsRef.current = updatedSortColumns;
    } else {
      // new sort column or changed direction
      if (isMultiSort) {
        setSortColumns([...updatedSortColumns, { columnKey, direction }]);
        sortColumnsRef.current = [...updatedSortColumns, { columnKey, direction }];
      } else {
        setSortColumns([{ columnKey, direction }]);
        sortColumnsRef.current = [{ columnKey, direction }];
      }
    }
  };

  const frameToRecords = useCallback((frame: DataFrame): Array<Record<string, string>> => {
    const fnBody = `
      const rows = Array(frame.length);
      const values = frame.fields.map(f => f.values);
      let rowCount = 0;
      for (let i = 0; i < frame.length; i++) {
        rows[rowCount] = {__depth: 0, __index: i, ${frame.fields.map((field, fieldIdx) => `${JSON.stringify(field.name)}: values[${fieldIdx}][i]`).join(',')}};
        rowCount += 1;
        if (rows[rowCount-1]['Nested frames']){
          const childFrame = rows[rowCount-1]['Nested frames'];
          rows[rowCount] = {__depth: 1, __index: i, data: childFrame[0]}
          rowCount += 1;
        }
      }
      return rows;
    `;

    const convert = new Function('frame', fnBody);

    const records = convert(frame);
    return records;
  }, []);
  const calcsRef = useRef<string[]>([]);
  const mapFrameToDataGrid = (main: DataFrame, calcsRef: React.MutableRefObject<string[]>) => {
    const columns: TableColumn[] = [];

    const hasNestedFrames = getIsNestedTable(main);

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
          return args.type === 'ROW' && Number(args.row.__depth) === 1 ? main.fields.length : 1;
        },
        renderCell: ({ row }) => {
          // TODO add TableRow type extension to include row depth and optional data
          if (Number(row.__depth) === 0) {
            const rowIdx = Number(row.__index);
            return (
              <RowExpander
                height={defaultRowHeight}
                onCellExpand={() => {
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
                }}
                isExpanded={expandedRows.includes(rowIdx)}
              />
            );
          }
          // If it's a child, render entire DataGrid at first column position
          let expandedColumns: TableColumn[] = [];
          let expandedRecords: Array<Record<string, string>> = [];
          expandedColumns = mapFrameToDataGrid(row.data, calcsRef);
          expandedRecords = frameToRecords(row.data);
          // TODO add renderHeaderCell HeaderCell's here and handle all features
          return (
            <DataGrid
              rows={expandedRecords}
              columns={expandedColumns}
              rowHeight={defaultRowHeight}
              style={{ height: '100%', overflow: 'visible', marginLeft: EXPANDER_WIDTH }}
              headerRowHeight={row.data.meta?.custom?.noHeader ? 0 : undefined}
            />
          );
        },
        width: EXPANDER_WIDTH,
        minWidth: EXPANDER_WIDTH,
      });
    }

    main.fields.map((field, fieldIndex) => {
      if (field.type === FieldType.nestedFrames) {
        // Don't render nestedFrames type field
        return;
      }
      const key = field.name;

      // get column width from overrides
      const override = fieldConfig?.overrides?.find(
        (o) => o.matcher.id === 'byName' && o.matcher.options === field.name
      );
      const width = override?.properties?.find((p) => p.id === 'width')?.value || field.config?.custom?.width;

      const justifyColumnContent = getTextAlign(field);
      const footerStyles = getFooterStyles(justifyColumnContent);

      // Add a column for each field
      columns.push({
        key,
        name: field.name,
        field,
        cellClass: styles.cell,
        renderCell: (props: any) => {
          const { row, rowIdx } = props;
          const value = row[key];
          // Cell level rendering here
          return (
            <TableCellNG
              key={key}
              value={value}
              field={field}
              theme={theme}
              timeRange={timeRange}
              height={defaultRowHeight}
              justifyContent={justifyColumnContent}
              rowIdx={rowIdx}
              shouldTextOverflow={() =>
                shouldTextOverflow(
                  key,
                  row,
                  columnTypes,
                  headerCellRefs,
                  osContext,
                  defaultLineHeight,
                  defaultRowHeight,
                  DEFAULT_CELL_PADDING,
                  textWrap,
                  cellInspect
                )
              }
              setIsInspecting={setIsInspecting}
              setContextMenuProps={setContextMenuProps}
              cellInspect={cellInspect}
              getActions={getActions}
            />
          );
        },
        renderSummaryCell: () => {
          if (isCountRowsSet && fieldIndex === 0) {
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Count</span>
                <span>{calcsRef.current[fieldIndex]}</span>
              </div>
            );
          }
          return <div className={footerStyles.footerCell}>{calcsRef.current[fieldIndex]}</div>;
        },
        renderHeaderCell: ({ column, sortDirection }) => (
          <HeaderCell
            column={column}
            rows={rows}
            field={field}
            onSort={handleSort}
            direction={sortDirection}
            justifyContent={justifyColumnContent}
            filter={filter}
            setFilter={setFilter}
            filterable={filterable}
            onColumnResize={onColumnResize}
            headerCellRefs={headerCellRefs}
            crossFilterOrder={crossFilterOrder}
            crossFilterRows={crossFilterRows}
          />
        ),
        // TODO these anys are making me sad
        width: width ?? columnWidth,
        minWidth: field.config?.custom?.minWidth ?? columnMinWidth,
      });
    });

    return columns;
  };

  function myRowRenderer(key: React.Key, props: RenderRowProps<TableRow>): React.ReactNode {
    // Let's render row level things here!
    // i.e. we can look at row styles and such here
    const { row } = props;
    // Don't render non expanded child rows
    if (Number(row.__depth) === 1 && !expandedRows.includes(Number(row.__index))) {
      return null;
    }
    return <Row key={key} {...props} />;
  }

  const rows = useMemo(() => frameToRecords(props.data), [frameToRecords, props.data]);

  // Create a map of column key to column type
  const columnTypes = useMemo(() => {
    return props.data.fields.reduce(
      (acc, field) => {
        acc[field.name] = field.type;
        return acc;
      },
      {} as { [key: string]: string }
    );
  }, [props.data.fields]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const comparators = sortColumns.map(({ columnKey }) => getComparator(columnTypes[columnKey]));
    const sortDirs = sortColumns.map(({ direction }) => (direction === 'ASC' ? 1 : -1));

    if (sortColumns.length === 0) {
      return rows;
    }

    return rows.slice().sort((a, b) => {
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
  }, [rows, sortColumns, columnTypes]);

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
      return sortedRows;
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

    return sortedRows.filter((row) => {
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
  }, [rows, filter, sortedRows, props.data.fields]); // eslint-disable-line react-hooks/exhaustive-deps

  // Paginated rows
  // TODO consolidate calculations into pagination wrapper component and only use when needed
  const numRows = filteredRows.length;
  // calculate number of rowsPerPage based on height stack
  let headerCellHeight = MAX_CELL_HEIGHT;
  if (noHeader) {
    headerCellHeight = 0;
  } else if (!noHeader && Object.keys(headerCellRefs.current).length > 0) {
    headerCellHeight = headerCellRefs.current[Object.keys(headerCellRefs.current)[0]].getBoundingClientRect().height;
  }
  let rowsPerPage = Math.floor((height - headerCellHeight - SCROLL_BAR_WIDTH - paginationHeight) / defaultRowHeight);
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
  const smallPagination = width < SMALL_PAGINATION_LIMIT;

  const paginatedRows = useMemo(() => {
    const pageOffset = page * rowsPerPage;
    return filteredRows.slice(pageOffset, pageOffset + rowsPerPage);
  }, [rows, filteredRows, page, rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useMemo(() => {
    calcsRef.current = props.data.fields.map((field, index) => {
      if (field.state?.calcs) {
        delete field.state?.calcs;
      }
      if (isCountRowsSet) {
        return index === 0 ? `${filteredRows.length}` : '';
      }
      if (index === 0) {
        const footerCalcReducer = footerOptions?.reducer[0];
        return footerCalcReducer ? fieldReducers.get(footerCalcReducer).name : '';
      }
      return getFooterItemNG(filteredRows, field, footerOptions);
    });
  }, [filteredRows, props.data.fields, footerOptions, isCountRowsSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => mapFrameToDataGrid(props.data, calcsRef),
    [props.data, calcsRef, filter, expandedRows, expandedRows.length, footerOptions] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const hasNestedFrames = getIsNestedTable(props.data);
    setIsNestedTable(hasNestedFrames);
  }, [props.data]);

  // This effect needed to set header cells refs before row height calculation
  useLayoutEffect(() => {
    setReadyForRowHeightCalc(Object.keys(headerCellRefs.current).length > 0);
  }, [columns]);

  const renderMenuItems = () => {
    return (
      <>
        <MenuItem
          label="Inspect value"
          onClick={() => {
            setIsInspecting(true);
          }}
          className={styles.menuItem}
        />
      </>
    );
  };

  const calculateRowHeight = useCallback(
    (row: TableRow) => {
      // Logic for sub-tables
      if (Number(row.__depth) === 1 && !expandedRows.includes(Number(row.__index))) {
        return 0;
      } else if (Number(row.__depth) === 1 && expandedRows.includes(Number(row.__index))) {
        const headerCount = row.data.meta?.custom?.noHeader ? 0 : 1;
        return defaultRowHeight * (row.data.length + headerCount); // TODO this probably isn't very robust
      }
      return getRowHeight(
        row,
        columnTypes,
        headerCellRefs,
        osContext,
        defaultLineHeight,
        defaultRowHeight,
        DEFAULT_CELL_PADDING
      );
    },
    [expandedRows, defaultRowHeight, columnTypes, headerCellRefs, osContext, defaultLineHeight]
  );

  // Return the data grid
  return (
    <>
      <ScrollContainer>
        <DataGrid
          className={styles.dataGrid}
          key={`DataGrid${revId}`}
          rows={enablePagination ? paginatedRows : filteredRows}
          columns={columns}
          headerRowHeight={noHeader ? 0 : undefined}
          defaultColumnOptions={{
            sortable: true,
            resizable: true,
          }}
          rowHeight={textWrap || isNestedTable ? calculateRowHeight : defaultRowHeight}
          // TODO: This doesn't follow current table behavior
          style={{ width, height: height - (enablePagination ? paginationHeight : 0) }}
          renderers={{ renderRow: myRowRenderer }}
          onCellContextMenu={({ row, column }, event) => {
            event.preventGridDefault();
            // Do not show the default context menu
            event.preventDefault();
            setContextMenuProps({
              // rowIdx: rows.indexOf(row),
              value: row[column.key],
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
      </ScrollContainer>

      {enablePagination && (
        <div className={styles.paginationContainer} ref={paginationWrapperRef}>
          <Pagination
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

type Comparator = (a: any, b: any) => number;

const compare = new Intl.Collator('en', { sensitivity: 'base' }).compare;

function getComparator(sortColumnType: string): Comparator {
  switch (sortColumnType) {
    case FieldType.time:
    case FieldType.number:
    case FieldType.boolean:
      return (a, b) => a - b;
    case FieldType.string:
    case FieldType.enum:
    default:
      return (a, b) => compare(String(a), String(b));
  }
}

const getStyles = (theme: GrafanaTheme2, textWrap: boolean) => ({
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
  }),
  menuItem: css({
    maxWidth: '200px',
  }),
  cell: css({
    '--rdg-border-color': theme.colors.border.medium,
    borderLeft: 'none',
    whiteSpace: `${textWrap ? 'break-spaces' : 'nowrap'}`,
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

const getFooterStyles = (justifyContent: Property.JustifyContent) => ({
  footerCell: css({
    display: 'flex',
    justifyContent: justifyContent || 'space-between',
  }),
});
