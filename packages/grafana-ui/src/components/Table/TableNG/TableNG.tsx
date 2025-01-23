import 'react-data-grid/lib/styles.css';
import { css } from '@emotion/css';
import { Property } from 'csstype';
import React, { useMemo, useState, useLayoutEffect, useCallback, useRef, useEffect } from 'react';
import DataGrid, { Column, RenderRowProps, Row, SortColumn, SortDirection } from 'react-data-grid';

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

import { useStyles2, useTheme2 } from '../../../themes';
import { ContextMenu } from '../../ContextMenu/ContextMenu';
import { Icon } from '../../Icon/Icon';
import { MenuItem } from '../../Menu/MenuItem';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { TableNGProps } from '../types';
import { getTextAlign } from '../utils';

import { TableCellNG } from './Cells/TableCellNG';
import { Filter } from './Filter/Filter';
import { getRowHeight, shouldTextOverflow, getFooterItemNG } from './utils';

const DEFAULT_CELL_PADDING = 6;
const COLUMN_MIN_WIDTH = 150;

type TableRow = Record<string, unknown>;

interface TableColumn extends Column<TableRow> {
  key: string;
  name: string;
  field: Field;
}

interface HeaderCellProps {
  column: Column<any>;
  field: Field;
  onSort: (columnKey: string, direction: SortDirection, isMultiSort: boolean) => void;
  direction: SortDirection | undefined;
  justifyContent?: Property.JustifyContent;
  filter: any;
}

export type FilterType = {
  [key: string]: {
    filteredSet: Set<string>;
  };
};

export function TableNG(props: TableNGProps) {
  const { height, width, timeRange, cellHeight, noHeader, fieldConfig, footerOptions, onColumnResize } = props;

  const textWrap = fieldConfig?.defaults?.custom?.cellOptions.wrapText ?? false;
  const filterable = fieldConfig?.defaults?.custom?.filterable ?? false;

  const theme = useTheme2();
  const styles = useStyles2(getStyles, textWrap);

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
    rowIdx: number;
    value: string;
    top: number;
    left: number;
  } | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>({});

  const crossFilterOrder = useRef<string[]>([]);
  const crossFilterRows = useRef<{ [key: string]: TableRow[] }>({});

  const headerCellRefs = useRef<Record<string, HTMLDivElement>>({});
  const [, setReadyForRowHeightCalc] = useState(false);

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

  function getDefaultRowHeight(): number {
    const bodyFontSize = theme.typography.fontSize;
    const lineHeight = theme.typography.body.lineHeight;

    switch (cellHeight) {
      case TableCellHeight.Sm:
        return 36;
      case TableCellHeight.Md:
        return 42;
      case TableCellHeight.Lg:
        return 48;
    }

    return DEFAULT_CELL_PADDING * 2 + bodyFontSize * lineHeight;
  }
  const defaultRowHeight = getDefaultRowHeight();
  const defaultLineHeight = theme.typography.body.lineHeight * theme.typography.fontSize;

  // TODO: move this component to a separate file
  const HeaderCell: React.FC<HeaderCellProps> = ({ column, field, onSort, direction, justifyContent, filter }) => {
    const headerRef = useRef<HTMLDivElement>(null);

    let isColumnFilterable = filterable;
    if (field.config.custom.filterable !== filterable) {
      isColumnFilterable = field.config.custom.filterable || false;
    }
    // we have to remove/reset the filter if the column is not filterable
    if (!isColumnFilterable && filter[field.name]) {
      setFilter((filter: FilterType) => {
        const newFilter = { ...filter };
        delete newFilter[field.name];
        return newFilter;
      });
    }

    const handleSort = (event: React.MouseEvent<HTMLButtonElement>) => {
      const isMultiSort = event.shiftKey;
      onSort(column.key as string, direction === 'ASC' ? 'DESC' : 'ASC', isMultiSort);
    };

    // collecting header cell refs to handle manual column resize
    useLayoutEffect(() => {
      if (headerRef.current) {
        headerCellRefs.current[column.key] = headerRef.current;
      }
    }, [headerRef, column.key]);

    // TODO: this is a workaround to handle manual column resize;
    useEffect(() => {
      const headerCellParent = headerRef.current?.parentElement;
      if (headerCellParent) {
        // `lastElement` is an HTML element added by react-data-grid for resizing columns.
        // We add a click event listener to `lastElement` to handle the end of the resize operation.
        const lastElement = headerCellParent.lastElementChild;
        if (lastElement) {
          const handleMouseUp = () => {
            let newWidth = headerCellParent.clientWidth;
            const columnMinWidth = column.minWidth;
            if (columnMinWidth && newWidth < columnMinWidth) {
              newWidth = columnMinWidth;
            }
            onColumnResize?.(column.key as string, newWidth);
          };

          lastElement.addEventListener('click', handleMouseUp);

          return () => {
            lastElement.removeEventListener('click', handleMouseUp);
          };
        }
      }
      // to handle "Not all code paths return a value." error
      return;
    }, [column]);

    return (
      <div ref={headerRef} style={{ display: 'flex', justifyContent }}>
        <button className={styles.headerCellLabel} onClick={handleSort}>
          <div>{column.name}</div>
          {direction &&
            (direction === 'ASC' ? (
              <Icon name="arrow-up" size="lg" className={styles.sortIcon} />
            ) : (
              <Icon name="arrow-down" size="lg" className={styles.sortIcon} />
            ))}
        </button>

        {isColumnFilterable && (
          <Filter
            name={column.key}
            rows={rows}
            filter={filter}
            setFilter={setFilter}
            field={field}
            crossFilterOrder={crossFilterOrder.current}
            crossFilterRows={crossFilterRows.current}
          />
        )}
      </div>
    );
  };

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

      for (let i = 0; i < frame.length; i++) {
        rows[i] = {index: i, ${frame.fields.map((field, fieldIdx) => `${JSON.stringify(field.name)}: values[${fieldIdx}][i]`).join(',')}};
      }

      return rows;
    `;

    const convert = new Function('frame', fnBody);

    const records = convert(frame);

    return records;
  }, []);

  const mapFrameToDataGrid = (main: DataFrame, calcsRef: React.MutableRefObject<string[]>) => {
    const columns: TableColumn[] = [];

    main.fields.map((field, fieldIndex) => {
      const key = field.name;

      // get column width from overrides
      const override = fieldConfig?.overrides?.find(
        (o) => o.matcher.id === 'byName' && o.matcher.options === field.name
      );
      const width = override?.properties?.find((p) => p.id === 'width')?.value || field.config.custom.width;

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
                  textWrap
                )
              }
            />
          );
        },
        ...(footerOptions?.show && {
          renderSummaryCell() {
            return <div className={footerStyles.footerCell}>{calcsRef.current[fieldIndex]}</div>;
          },
        }),
        renderHeaderCell: ({ column, sortDirection }) => (
          <HeaderCell
            column={column}
            field={field}
            onSort={handleSort}
            direction={sortDirection}
            justifyContent={justifyColumnContent}
            filter={filter}
          />
        ),
        // TODO these anys are making me sad
        width: width ?? columnWidth,
        minWidth: field.config.custom.minWidth ?? columnMinWidth,
      });
    });

    return columns;
  };

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

  const calcsRef = useRef<string[]>([]);
  useMemo(() => {
    calcsRef.current = props.data.fields.map((field, index) => {
      if (field.state?.calcs) {
        delete field.state?.calcs;
      }
      if (isCountRowsSet) {
        return index === 0 ? `Count: ${filteredRows.length}` : '';
      }
      if (index === 0) {
        return footerOptions ? fieldReducers.get(footerOptions.reducer[0]).name : '';
      }
      return getFooterItemNG(filteredRows, field, footerOptions);
    });
  }, [filteredRows, props.data.fields, footerOptions, isCountRowsSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => mapFrameToDataGrid(props.data, calcsRef), [props.data, calcsRef]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Return the data grid
  return (
    <>
      <DataGrid
        key={`DataGrid${revId}`}
        rows={filteredRows}
        columns={columns}
        headerRowHeight={noHeader ? 0 : undefined}
        defaultColumnOptions={{
          sortable: true,
          resizable: true,
        }}
        rowHeight={(row) =>
          getRowHeight(
            row,
            columnTypes,
            headerCellRefs,
            osContext,
            defaultLineHeight,
            defaultRowHeight,
            DEFAULT_CELL_PADDING,
            textWrap
          )
        }
        // TODO: This doesn't follow current table behavior
        style={{ width, height }}
        renderers={{ renderRow: myRowRenderer }}
        onCellContextMenu={({ row, column }, event) => {
          event.preventGridDefault();
          // Do not show the default context menu
          event.preventDefault();
          setContextMenuProps({
            rowIdx: rows.indexOf(row),
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
        bottomSummaryRows={footerOptions?.show && footerOptions.reducer.length ? [{}] : undefined}
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
          mode={TableCellInspectorMode.text}
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

function myRowRenderer(key: React.Key, props: RenderRowProps<TableRow>): React.ReactNode {
  // Let's render row level things here!
  // i.e. we can look at row styles and such here
  return <Row key={key} {...props} />;
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
  menuItem: css({
    maxWidth: '200px',
  }),
  headerCellLabel: css({
    border: 'none',
    padding: 0,
    background: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: theme.typography.fontWeightMedium,
    display: 'flex',
    alignItems: 'center',
    marginRight: theme.spacing(0.5),

    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.text.link,
    },
  }),
  sortIcon: css({
    marginLeft: theme.spacing(0.5),
  }),
  cell: css({
    whiteSpace: `${textWrap ? 'break-spaces' : 'nowrap'}`,
    wordWrap: 'break-word',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});

const getFooterStyles = (justifyContent: Property.JustifyContent) => ({
  footerCell: css({
    display: 'flex',
    justifyContent: justifyContent || 'space-between',
  }),
});
