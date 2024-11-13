import 'react-data-grid/lib/styles.css';
import { css } from '@emotion/css';
import { Property } from 'csstype';
import React, { useMemo, useState, useLayoutEffect, useCallback, useRef } from 'react';
import DataGrid, { Column, RenderRowProps, Row, SortColumn, SortDirection } from 'react-data-grid';

import { DataFrame, Field, FieldType, GrafanaTheme2, ReducerID } from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../themes';
import { ContextMenu } from '../../ContextMenu/ContextMenu';
import { Icon } from '../../Icon/Icon';
import { MenuItem } from '../../Menu/MenuItem';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { FooterItem, TableNGProps } from '../types';
import { getTextAlign, getFooterItems } from '../utils';

import { getFooterValue } from './Cells/FooterCell';
import { TableCellNG } from './Cells/TableCellNG';
import { getCellHeight } from './utils';

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
  onSort: (columnKey: string, direction: SortDirection) => void;
  direction: SortDirection | undefined;
  justifyContent?: Property.JustifyContent;
}

export function TableNG(props: TableNGProps) {
  const { height, width, timeRange, cellHeight, noHeader, fieldConfig, footerOptions } = props;

  const textWrap = fieldConfig?.defaults?.custom?.cellOptions.wrapText ?? false;

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
  }, [fieldConfig, props.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const columnMinWidth = fieldConfig?.defaults?.custom?.minWidth || COLUMN_MIN_WIDTH;

  const [contextMenuProps, setContextMenuProps] = useState<{
    rowIdx: number;
    value: string;
    top: number;
    left: number;
  } | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  const headerCellRefs = useRef<Record<string, HTMLDivElement>>({});
  const [readyForRowHeightCalc, setReadyForRowHeightCalc] = useState(false);

  // This state will trigger re-render for recalculating row heights
  const [resizeTrigger, setResizeTrigger] = useState(0);

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

  function getRowHeight(): number {
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
  const defaultRowHeight = getRowHeight();
  const defaultLineHeight = theme.typography.body.lineHeight * theme.typography.fontSize;

  const HeaderCell: React.FC<HeaderCellProps> = ({ column, onSort, direction, justifyContent }) => {
    const headerRef = useRef(null);

    const handleSort = () => {
      onSort(column.key as string, direction === 'ASC' ? 'DESC' : 'ASC');
    };

    useLayoutEffect(() => {
      if (headerRef.current) {
        headerCellRefs.current[column.key] = headerRef.current;
      }
    }, [headerRef, column.key]);

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

        {/* put the filter button here */}
      </div>
    );
  };

  const handleSort = (columnKey: string, direction: SortDirection) => {
    let currentSortColumn: SortColumn | undefined;

    const updatedSortColumns = sortColumns.filter((column) => {
      const isCurrentColumn = column.columnKey === columnKey;
      if (isCurrentColumn) {
        currentSortColumn = column;
      }
      return !isCurrentColumn;
    });

    // sorted column exists and is descending -> remove it to reset sorting
    if (currentSortColumn && currentSortColumn.direction === 'DESC') {
      setSortColumns(updatedSortColumns);
    } else {
      // new sort column or changed direction
      setSortColumns([...updatedSortColumns, { columnKey, direction }]);
    }
  };

  const mapFrameToDataGrid = (main: DataFrame) => {
    const columns: TableColumn[] = [];

    // Footer calculations
    let footerItems: FooterItem[] = [];
    const filterFields: Array<{ id: string; field?: Field } | undefined> = [];
    const allValues: any[][] = [];

    main.fields.map((field, fieldIndex) => {
      filterFields.push({ id: fieldIndex.toString(), field });
      const key = field.name;

      const justifyColumnContent = getTextAlign(field);

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
              rowIdx={rowIdx}
              justifyContent={justifyColumnContent}
            />
          );
        },
        ...(footerOptions?.show && {
          renderSummaryCell() {
            return <>{getFooterValue(fieldIndex, footerItems, isCountRowsSet, justifyColumnContent)}</>;
          },
        }),
        renderHeaderCell: ({ column, sortDirection }) => (
          <HeaderCell
            column={column}
            onSort={handleSort}
            direction={sortDirection}
            justifyContent={justifyColumnContent}
          />
        ),
        // TODO these anys are making me sad
        width: field.config.custom.width ?? columnWidth,
        minWidth: field.config.custom.minWidth ?? columnMinWidth,
      });

      // Create row objects
      if (footerOptions?.show && footerOptions.reducer.length > 0) {
        // Only populate 2d array if needed for footer calculations
        allValues.push(field.values);
      }
    });

    if (footerOptions?.show && footerOptions.reducer.length > 0) {
      if (footerOptions.countRows) {
        footerItems = ['Count', rows.length.toString()];
      } else {
        footerItems = getFooterItems(filterFields, allValues, footerOptions, theme);
      }
    }

    return columns;
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

  const columns = mapFrameToDataGrid(props.data);

  useLayoutEffect(() => {
    setReadyForRowHeightCalc(Object.keys(headerCellRefs.current).length > 0);
  }, [columns]);

  const rows = useMemo(() => frameToRecords(props.data), [frameToRecords, props.data]);

  const columnTypes = useMemo(() => {
    return columns.reduce(
      (acc, column) => {
        acc[column.key] = column.field.type;
        return acc;
      },
      {} as { [key: string]: string }
    );
  }, [columns]);

  const sortedRows = useMemo((): ReadonlyArray<{ [key: string]: string }> => {
    if (sortColumns.length === 0) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      for (const sort of sortColumns) {
        const { columnKey, direction } = sort;
        const comparator = getComparator(columnTypes[columnKey]);
        const compResult = comparator(a[columnKey], b[columnKey]);
        if (compResult !== 0) {
          return direction === 'ASC' ? compResult : -compResult;
        }
      }
      return 0; // false
    });
  }, [rows, sortColumns, columnTypes]);

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
        rows={sortedRows}
        columns={columns}
        headerRowHeight={noHeader ? 0 : undefined}
        defaultColumnOptions={{
          sortable: true,
          resizable: true,
        }}
        rowHeight={(row) =>
          rowHeight(
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
        bottomSummaryRows={footerOptions?.show && footerOptions.reducer.length ? [true] : undefined}
        onColumnResize={() => {
          // TODO: this is a hack to force rowHeight re-calculation
          setResizeTrigger((prev) => prev + 1);
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

function rowHeight(
  row: Record<string, unknown>,
  columnTypes: Record<string, string>,
  headerCellRefs: React.MutableRefObject<Record<string, HTMLDivElement>>,
  osContext: OffscreenCanvasRenderingContext2D | null,
  lineHeight: number,
  defaultRowHeight: number,
  padding: number,
  textWrap: boolean
): number {
  if (!textWrap) {
    return defaultRowHeight;
  }
  /**
   * 0. loop through all cells in row
   * 1. find text cell in row
   * 2. find width of text cell
   * 3. calculate height based on width and text length
   * 4. return biggest height
   */

  let biggestHeight = defaultRowHeight;

  for (const key in row) {
    if (isTextCell(key, columnTypes)) {
      if (Object.keys(headerCellRefs.current).length === 0) {
        return biggestHeight;
      }
      const cellWidth = headerCellRefs.current[key].offsetWidth;
      const cellText = row[key];
      const newCellHeight = getCellHeight(cellText, cellWidth, osContext, lineHeight, defaultRowHeight, padding);

      if (newCellHeight > biggestHeight) {
        biggestHeight = newCellHeight;
      }
    }
  }

  return biggestHeight;
}

function isTextCell(key: string, columnTypes: Record<string, string>): boolean {
  return columnTypes[key] === FieldType.string;
}

function myRowRenderer(key: React.Key, props: RenderRowProps<TableRow>): React.ReactNode {
  // Let's render row level things here!
  // i.e. we can look at row styles and such here
  return <Row {...props} />;
}

type Comparator = (a: any, b: any) => number;

function getComparator(sortColumnType: string): Comparator {
  switch (sortColumnType) {
    case FieldType.time:
    case FieldType.number:
    case FieldType.boolean:
      return (a, b) => a - b;
    case FieldType.string:
    case FieldType.enum:
    default:
      return (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
  }
}

const getStyles = (theme: GrafanaTheme2, textWrap: boolean) => ({
  contextMenu: css({
    position: 'absolute',
    backgroundColor: '#ffffff',
    border: '1px solid black',
    padding: '16px',
    listStyle: 'none',

    '> li': {
      padding: 8,
    },
  }),
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
