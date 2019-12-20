import React, { useMemo } from 'react';
import { DataFrame } from '@grafana/data';
// @ts-ignore
import { useBlockLayout, useSortBy, useTable } from 'react-table';
import { FixedSizeList } from 'react-window';
import { getTableStyles } from './styles';
import { getColumns, getTableRows } from './models';
import { useTheme } from '../../themes';

export interface Props {
  data: DataFrame;
  width: number;
  height: number;
  onCellClick?: (key: string, value: string) => void;
}

const renderCell = (cell: any, columnWidth: number, cellStyles: string, onCellClick?: any) => {
  const filterable = cell.column.field.config.filterable;
  const style = {
    cursor: `${filterable && onCellClick ? 'pointer' : 'default'}`,
  };
  console.log(cell);

  return (
    <div
      className={cellStyles}
      {...cell.getCellProps()}
      onClick={filterable ? () => onCellClick(cell.column.Header, cell.value) : undefined}
      style={style}
    >
      {cell.render('Cell')}
    </div>
  );
};

export const NewTable = ({ data, height, onCellClick, width }: Props) => {
  const theme = useTheme();
  const columnWidth = Math.floor(width / data.fields.length);
  const tableStyles = getTableStyles(theme, columnWidth);
  const { getTableProps, headerGroups, rows, prepareRow } = useTable(
    {
      columns: useMemo(() => getColumns(data, theme), [data]),
      data: useMemo(() => getTableRows(data), [data]),
    },
    useSortBy,
    useBlockLayout
  );

  const RenderRow = React.useCallback(
    ({ index, style }) => {
      const row = rows[index];
      prepareRow(row);
      return (
        <div {...row.getRowProps({ style })}>
          {row.cells.map((cell: any) => renderCell(cell, columnWidth, tableStyles.tableCell, onCellClick))}
        </div>
      );
    },
    [prepareRow, rows]
  );

  return (
    <div {...getTableProps()}>
      <div>
        {headerGroups.map((headerGroup: any) => (
          <div {...headerGroup.getHeaderGroupProps()} style={{ display: 'table-row' }}>
            {headerGroup.headers.map((column: any) => (
              <div
                className={tableStyles.tableHeader}
                {...column.getHeaderProps(column.getSortByToggleProps())}
                style={{ display: 'table-cell', width: `${columnWidth}px` }}
              >
                {column.render('Header')}
                <span>{column.isSorted ? (column.isSortedDesc ? ' 🔽' : ' 🔼') : ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <FixedSizeList height={height} itemCount={rows.length} itemSize={tableStyles.cellHeight} width={width}>
        {RenderRow}
      </FixedSizeList>
    </div>
  );
};
