import 'react-data-grid/lib/styles.css';
import { css } from '@emotion/css';
import { set } from 'lodash';
import React, { useMemo, useState, useLayoutEffect, useEffect } from 'react';
import DataGrid, { Column, RenderRowProps, Row, SortColumn, SortDirection } from 'react-data-grid';
import { Cell } from 'react-table';

import { DataFrame, Field, FieldType, getFieldMatcher, GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../../themes';
import { ContextMenu } from '../../ContextMenu/ContextMenu';
import { Icon } from '../../Icon/Icon';
import { MenuItem } from '../../Menu/MenuItem';
import { TableCellInspector, TableCellInspectorMode } from '../TableCellInspector';
import { TableCellDisplayMode, TableNGProps } from '../types';
import { getCellColors } from '../utils';

import { TableCellNG } from './Cells/TableCellNG';

const DEFAULT_CELL_PADDING = 6;

interface TableRow {
  id: number;
  title: string;
  cell: Cell;
}

interface TableColumn extends Column<TableRow> {
  key: string;
  name: string;
  rowHeight: number;
  field: Omit<Field, 'values'>;
}

interface TableHeaderProps {
  column: Column<any>;
  onSort: (columnKey: string, direction: SortDirection) => void;
  direction: SortDirection | undefined;
}

let resizeTimer;

export function TableNG(props: TableNGProps) {
  const { height, width, timeRange, cellHeight, noHeader, fieldConfig, onColumnResize } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  // TODO: this is a hack to force the column width to update when the fieldConfig changes
  const [revId, setRevId] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const columnWidth = useMemo(() => {
    setRevId(revId + 1);
    return fieldConfig?.defaults?.custom?.width || 'auto';
  }, [fieldConfig]); // eslint-disable-line react-hooks/exhaustive-deps
  const columnMinWidth = fieldConfig?.defaults?.custom?.minWidth || 150;

  let currentResize = { columnKey: '', width: 0 };

  const [contextMenuProps, setContextMenuProps] = useState<{
    rowIdx: number;
    value: string;
    top: number;
    left: number;
  } | null>(null);

  // const refTable = React.useRef<DataGrid<TableRow>>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  const handleDragging = () => {
    console.log('handleDragging', isDragging);
    setIsDragging(false);
  };

  useEffect(() => {
    console.log('useEffect', isDragging);
    if (isDragging) {
      addEventListener('onmouseup', handleDragging);
    } else {
      removeEventListener('onmouseup', handleDragging);
    }
  }, [isDragging]);

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

  // useEffect(() => {
  //   const tableEl = refTable.current
  //   if (tableEl) {
  //     tableEl.addEventListener('mouseup', (event) => {
  //       console.log('mouseup', event);
  //     });
  //   }
  // }, []);

  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([]);

  function rowHeight() {
    const bodyFontSize = theme.typography.fontSize;
    const lineHeight = theme.typography.body.lineHeight;

    switch (cellHeight) {
      case 'md':
        return 42;
      case 'lg':
        return 48;
    }

    return DEFAULT_CELL_PADDING * 2 + bodyFontSize * lineHeight;
  }
  const rowHeightNumber = rowHeight();

  const TableHeader: React.FC<TableHeaderProps> = ({ column, onSort, direction }) => {
    const handleSort = () => {
      onSort(column.key as string, direction === 'ASC' ? 'DESC' : 'ASC');
    };

    return (
      <div>
        <button className={styles.headerCellLabel} onClick={handleSort}>
          <div>{column.name}</div>
          {direction &&
            (direction === 'ASC' ? (
              <Icon size="lg" name="arrow-down" className={styles.sortIcon} />
            ) : (
              <Icon name="arrow-up" size="lg" className={styles.sortIcon} />
            ))}
        </button>

        {/* put the filter button here */}
      </div>
    );
  };

  const handleSort = (columnKey: string, direction: SortDirection) => {
    setSortColumns([{ columnKey, direction }]);
  };

  const mapFrameToDataGrid = (main: DataFrame) => {
    const columns: TableColumn[] = [];
    const rows: Array<{ [key: string]: string }> = [];

    main.fields.map((field) => {
      const key = `${field.name}-${revId}`;
      const { values: _, ...shallowField } = field;

      // overrides
      let columnWidthOverride = columnWidth;
      fieldConfig?.overrides?.forEach((override) => {
        const matcher = getFieldMatcher(override.matcher);
        if (matcher(field, props.data, [props.data])) {
          for (const property of override.properties) {
            if (property.id === 'custom.width') {
              columnWidthOverride = property.value;
            }
          }
        }
      });

      // Add a column for each field
      columns.push({
        key,
        name: field.name,
        field: shallowField,
        rowHeight: rowHeightNumber,
        cellClass: (row) => {
          // eslint-ignore-next-line
          const value = row[key];
          const displayValue = shallowField.display!(value);

          // if (shallowField.config.custom.type === TableCellDisplayMode.ColorBackground) {
          let colors = getCellColors(theme, shallowField.config.custom, displayValue);
          // }

          // css()
          return 'my-class';
        },
        renderCell: (props: any) => {
          const { row } = props;
          const value = row[key];

          // Cell level rendering here
          return (
            <TableCellNG
              key={key}
              value={value}
              field={shallowField}
              theme={theme}
              timeRange={timeRange}
              height={rowHeight}
            />
          );
        },
        renderHeaderCell: ({ column, sortDirection }) => (
          <TableHeader column={column} onSort={handleSort} direction={sortDirection} />
        ),
        width: columnWidthOverride,
        minWidth: columnMinWidth,
      });

      // Create row objects
      field.values.map((value, index) => {
        const currentValue = { [key]: value };

        if (rows.length > index) {
          rows[index] = { ...rows[index], ...currentValue };
        } else {
          rows[index] = currentValue;
        }
      });
    });

    return {
      columns,
      rows,
    };
  };
  const { columns, rows } = mapFrameToDataGrid(props.data);

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

  // useEffect(() => {
  //   console.log('=====useEffect======');
  //   function handleResizeEnd() {
  //     console.log('handleResizeEnd', currentResize);
  //     if (currentResize.columnKey) {
  //       onColumnResize!(currentResize.columnKey, currentResize.width); // Trigger on release
  //       currentResize = { columnKey: '', width: 0 }; // Reset
  //     }
  //   }

  //   document.addEventListener('mousedown', event => console.log('mousedown', event));
  //   // document.addEventListener('mousemove', event => console.log('mousemove', event));
  //   document.addEventListener('mouseup', event => console.log('mouseup', event));
  //   document.addEventListener('dragend', handleResizeEnd);

  //   // Clean up the event listener on unmount
  //   return () => {
  //     document.removeEventListener('dragend', handleResizeEnd);
  //     document.removeEventListener('mousedown', event => console.log('mousedown', event));
  //     // document.removeEventListener('mousemove', event => console.log('mousemove', event));
  //     document.removeEventListener('mouseup', event => console.log('mouseup', event));
  //   };
  // }, []);

  // Return the data grid
  return (
    <>
      <DataGrid
        // ref={refTable}
        rows={sortedRows}
        columns={columns}
        headerRowHeight={noHeader ? 0 : undefined}
        defaultColumnOptions={{
          sortable: true,
          resizable: true,
        }}
        rowHeight={rowHeightNumber}
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
        onColumnResize={(columnKey, width) => {
          setIsDragging(true);
          console.log('onColumnResize', columnKey, width);
          // currentResize = { columnKey: columns[columnKey].name, width };
          // onColumnResize!(columns[columnKey].name, width);

          // const column = columns.find((c) => c.key === columnKey);
          // if (column) {
          //   column.width = width;
          // }
          // setRevId(revId + 1);

          // if (resizeTimer) clearTimeout(resizeTimer);

          // // Delay the onColumnResize call by 200ms (or whatever time feels right)
          // resizeTimer = setTimeout(() => {
          //     onColumnResize!(columns[columnKey].name, width);
          // }, 200);
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

function myRowRenderer(key: React.Key, props: RenderRowProps<Row>) {
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

const getStyles = (theme: GrafanaTheme2) => ({
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
});
