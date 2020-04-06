import React, { FC, memo, useMemo } from 'react';
import { DataFrame, Field } from '@grafana/data';
import { Cell, Column, HeaderGroup, useBlockLayout, useResizeColumns, useSortBy, useTable } from 'react-table';
import { FixedSizeList } from 'react-window';
import useMeasure from 'react-use/lib/useMeasure';
import { getColumns, getTableRows, getTextAlign } from './utils';
import { useTheme } from '../../themes';
import { TableFilterActionCallback } from './types';
import { getTableStyles, TableStyles } from './styles';
import { TableCell } from './TableCell';
import { Icon } from '../Icon/Icon';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';

const COLUMN_MIN_WIDTH = 150;

export interface Props {
  data: DataFrame;
  width: number;
  height: number;
  /** Minimal column width specified in pixels */
  columnMinWidth?: number;
  noHeader?: boolean;
  resizable?: boolean;
  onCellClick?: TableFilterActionCallback;
}

export const Table: FC<Props> = memo(
  ({ data, height, onCellClick, width, columnMinWidth = COLUMN_MIN_WIDTH, noHeader, resizable = false }) => {
    const theme = useTheme();
    const [ref, headerRowMeasurements] = useMeasure();
    const tableStyles = getTableStyles(theme);
    const memoizedColumns = useMemo(() => getColumns(data, width, columnMinWidth), [data, width, columnMinWidth]);
    const memoizedData = useMemo(() => getTableRows(data), [data]);
    const defaultColumn = React.useMemo(
      () => ({
        minWidth: memoizedColumns.reduce((minWidth, column) => {
          if (column.width) {
            const width = typeof column.width === 'string' ? parseInt(column.width, 10) : column.width;
            return Math.min(minWidth, width);
          }
          return minWidth;
        }, columnMinWidth),
      }),
      [columnMinWidth, memoizedColumns]
    );
    const options: any = useMemo(
      () => ({
        columns: memoizedColumns,
        data: memoizedData,
        disableResizing: !resizable,
        defaultColumn,
      }),
      [memoizedColumns, memoizedData, resizable, defaultColumn]
    );
    const { getTableProps, headerGroups, rows, prepareRow, totalColumnsWidth } = useTable(
      options,
      useSortBy,
      useBlockLayout,
      useResizeColumns
    );

    const RenderRow = React.useCallback(
      ({ index, style }) => {
        const row = rows[index];
        prepareRow(row);
        return (
          <div {...row.getRowProps({ style })} className={tableStyles.row}>
            {row.cells.map((cell: Cell, index: number) => (
              <TableCell
                key={index}
                field={data.fields[index]}
                tableStyles={tableStyles}
                cell={cell}
                onCellClick={onCellClick}
              />
            ))}
          </div>
        );
      },
      [prepareRow, rows]
    );

    return (
      <div {...getTableProps()} className={tableStyles.table}>
        <CustomScrollbar>
          <div style={{ width: `${totalColumnsWidth}px` }}>
            {!noHeader && (
              <>
                {headerGroups.map((headerGroup: HeaderGroup) => {
                  return (
                    <div className={tableStyles.thead} {...headerGroup.getHeaderGroupProps()} ref={ref}>
                      {headerGroup.headers.map((column: Column, index: number) =>
                        renderHeaderCell(column, tableStyles, data.fields[index])
                      )}
                    </div>
                  );
                })}
              </>
            )}
            <FixedSizeList
              height={height - headerRowMeasurements.height}
              itemCount={rows.length}
              itemSize={tableStyles.rowHeight}
              width={'100%'}
              style={{ overflow: 'hidden auto' }}
            >
              {RenderRow}
            </FixedSizeList>
          </div>
        </CustomScrollbar>
      </div>
    );
  }
);

function renderHeaderCell(column: any, tableStyles: TableStyles, field?: Field) {
  const headerProps = column.getHeaderProps(column.getSortByToggleProps());
  if (column.canResize) {
    headerProps.style.userSelect = column.isResizing ? 'none' : 'auto'; // disables selecting text while resizing
    column.disableSortBy = column.isResizing; // disables sorting while resizing, unfortunate side effect that the column will not be sortable until re-render
  }

  const fieldTextAlign = getTextAlign(field);

  if (fieldTextAlign) {
    headerProps.style.textAlign = fieldTextAlign;
  }

  return (
    <div className={tableStyles.headerCell} {...headerProps}>
      {column.render('Header')}
      {column.isSorted && (column.isSortedDesc ? <Icon name="caret-down" /> : <Icon name="caret-up" />)}
      {column.canResize && <div {...column.getResizerProps()} className={tableStyles.resizeHandle} />}
    </div>
  );
}
