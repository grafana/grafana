import { css } from '@emotion/css';
import React, { useLayoutEffect, useRef, useState } from 'react';
import 'react-data-grid/lib/styles.css';
import DataGrid, { Column, RenderRowProps, Row } from 'react-data-grid';
import { createPortal } from 'react-dom';
import { Cell } from 'react-table';

import { DataFrame, Field, GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../../themes';
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

export function TableNG(props: TableNGProps) {
  const { height, width, timeRange, cellHeight } = props;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const [contextMenuProps, setContextMenuProps] = useState<{
    rowIdx: number;
    value: string;
    top: number;
    left: number;
  } | null>(null);
  const menuRef = useRef<HTMLMenuElement | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const isContextMenuOpen = contextMenuProps !== null;

  useLayoutEffect(() => {
    if (!isContextMenuOpen) {
      return;
    }

    function onClick(event: MouseEvent) {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) {
        return;
      }
      setContextMenuProps(null);
    }

    addEventListener('click', onClick);

    return () => {
      removeEventListener('click', onClick);
    };
  }, [isContextMenuOpen]);

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

  const mapFrameToDataGrid = (main: DataFrame) => {
    const columns: TableColumn[] = [];
    const rows: Array<{ [key: string]: string }> = [];

    main.fields.map((field) => {
      const key = field.name;
      const { values: _, ...shallowField } = field;

      // Add a column for each field
      columns.push({
        key,
        name: key,
        field: shallowField,
        rowHeight: rowHeightNumber,
        cellClass: (row) => {
          console.log(row);
          // eslint-ignore-next-line
          const value = row[key];
          const displayValue = shallowField.display!(value);

          console.log(value);
          // if (shallowField.config.custom.type === TableCellDisplayMode.ColorBackground) {
          let colors = getCellColors(theme, shallowField.config.custom, displayValue);
          console.log(colors);
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

  // Return the data grid
  return (
    <>
      <DataGrid
        rows={rows}
        columns={columns}
        defaultColumnOptions={{
          sortable: true,
          resizable: true,
          maxWidth: 200,
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
        }}
      />

      {isContextMenuOpen &&
        createPortal(
          <menu
            ref={menuRef}
            className={styles.contextMenu}
            style={
              {
                top: contextMenuProps.top,
                left: contextMenuProps.left,
              } as unknown as React.CSSProperties
            }
          >
            <li>
              <button
                type="button"
                onClick={() => {
                  setIsInspecting(true);
                }}
              >
                Inspect value
              </button>
            </li>
          </menu>,
          document.body
        )}

      {isInspecting && (
        <TableCellInspector
          mode={TableCellInspectorMode.text}
          value={contextMenuProps?.value}
          onDismiss={() => {
            setIsInspecting(false);
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
});
