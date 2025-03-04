import 'react-data-grid/lib/styles.css';
import { css } from '@emotion/css';
import { useMemo, useState, useLayoutEffect, useCallback, useRef, useEffect } from 'react';
import DataGrid, { SortColumn } from 'react-data-grid';
import { useMeasure } from 'react-use';

import { fieldReducers, formattedValueToString, GrafanaTheme2, ReducerID } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../../themes';
import { Trans } from '../../../utils/i18n';
import { ContextMenu } from '../../ContextMenu/ContextMenu';
import { MenuItem } from '../../Menu/MenuItem';
import { Pagination } from '../../Pagination/Pagination';
import { ScrollContainer } from '../../ScrollContainer/ScrollContainer';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';

import { TABLE } from './constants';
import { TableNGProps, FilterType, TableRow, TableSummaryRow, ColumnTypes } from './types';
import {
  frameToRecords,
  getComparator,
  getDefaultRowHeight,
  getFooterItemNG,
  getIsNestedTable,
  getRowHeight,
  mapFrameToDataGrid,
  myRowRenderer,
} from './utils';

export function TableNG(props: TableNGProps) {
  const {
    cellHeight,
    enablePagination,
    enableVirtualization = true,
    fieldConfig,
    footerOptions,
    height,
    noHeader,
    onColumnResize,
    width,
  } = props;

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
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [isNestedTable, setIsNestedTable] = useState(false);

  /* ------------------------------- Local refs ------------------------------- */
  const crossFilterOrder = useRef<string[]>([]);
  const crossFilterRows = useRef<Record<string, TableRow[]>>({});
  const headerCellRefs = useRef<Record<string, HTMLDivElement>>({});
  // TODO: This ref persists sortColumns between renders. setSortColumns is still used to trigger re-render
  const sortColumnsRef = useRef(sortColumns);
  const prevProps = useRef(props);
  const calcsRef = useRef<string[]>([]);
  const [paginationWrapperRef, { height: paginationHeight }] = useMeasure<HTMLDivElement>();

  const textWrap = fieldConfig?.defaults?.custom?.cellOptions.wrapText ?? false;

  const theme = useTheme2();
  const styles = useStyles2(getStyles, textWrap);

  const isFooterVisible = Boolean(footerOptions?.show && footerOptions.reducer?.length);
  const isCountRowsSet = Boolean(
    footerOptions?.countRows &&
      footerOptions.reducer &&
      footerOptions.reducer.length &&
      footerOptions.reducer[0] === ReducerID.count
  );

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

  // TODO: this is a hack to force the column width to update when the fieldConfig changes
  const columnWidth = useMemo(() => {
    setRevId(revId + 1);
    return fieldConfig?.defaults?.custom?.width || 'auto';
  }, [fieldConfig]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const defaultRowHeight = getDefaultRowHeight(theme, cellHeight);
  const defaultLineHeight = theme.typography.body.lineHeight * theme.typography.fontSize;
  const panelPaddingHeight = theme.components.panel.padding * theme.spacing.gridSize * 2;

  /* ------------------------------ Rows & Columns ----------------------------- */
  const rows = useMemo(() => frameToRecords(props.data), [frameToRecords, props.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create a map of column key to column type
  const columnTypes = useMemo(() => {
    return props.data.fields.reduce((acc, field) => {
      acc[field.name] = field.type;
      return acc;
    }, {} as ColumnTypes);
  }, [props.data.fields]);

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

  const columns = useMemo(
    () =>
      mapFrameToDataGrid({
        frame: props.data,
        calcsRef,
        options: {
          columnTypes,
          columnWidth,
          crossFilterOrder,
          crossFilterRows,
          defaultLineHeight,
          defaultRowHeight,
          expandedRows,
          filter,
          headerCellRefs,
          isCountRowsSet,
          osContext,
          rows,
          setContextMenuProps,
          setFilter,
          setIsInspecting,
          setSortColumns,
          sortColumnsRef,
          styles,
          textWrap,
          theme,
          ...props,
        },
        handlers: {
          onCellExpand,
          onColumnResize: onColumnResize!,
        },
      }),
    [props.data, calcsRef, filter, expandedRows, expandedRows.length, footerOptions] // eslint-disable-line react-hooks/exhaustive-deps
  );

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
        const headerCount = row?.data?.meta?.custom?.noHeader ? 0 : 1;
        return defaultRowHeight * (row.data?.length ?? 0 + headerCount); // TODO this probably isn't very robust
      }
      return getRowHeight(
        row,
        columnTypes,
        headerCellRefs,
        osContext,
        defaultLineHeight,
        defaultRowHeight,
        TABLE.CELL_PADDING
      );
    },
    [expandedRows, defaultRowHeight, columnTypes, headerCellRefs, osContext, defaultLineHeight]
  );

  return (
    <>
      <ScrollContainer>
        <DataGrid<TableRow, TableSummaryRow>
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
          renderers={{ renderRow: (key, props) => myRowRenderer(key, props, expandedRows) }}
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
      </ScrollContainer>

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
