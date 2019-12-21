import React, { useMemo, CSSProperties } from 'react';
import { DataFrame } from '@grafana/data';
// @ts-ignore
import { useSortBy, useTable, useBlockLayout } from 'react-table';
import { FixedSizeList } from 'react-window';
import { getTableStyles } from './styles';
import { getColumns, getTableRows } from './utils';
import { TableColumn } from './types';
import { useTheme } from '../../themes';

export interface Props {
  data: DataFrame;
  width: number;
  height: number;
  onCellClick?: (key: string, value: string) => void;
}

interface RenderCellProps {
  column: TableColumn;
  value: any;
  getCellProps: () => { style: CSSProperties };
  render: (component: string) => React.ReactNode;
}

function renderCell(cell: RenderCellProps, className: string, onCellClick?: any) {
  const filterable = cell.column.field.config.filterable;
  const cellProps = cell.getCellProps();
  let onClick: ((event: React.SyntheticEvent) => void) | undefined = undefined;

  if (filterable && onCellClick) {
    cellProps.style.cursor = 'pointer';
    onClick = () => onCellClick(cell.column.Header, cell.value);
  }

  if (cell.column.textAlign) {
    cellProps.style.textAlign = cell.column.textAlign;
  }

  return (
    <div className={className} {...cellProps} onClick={onClick}>
      {cell.render('Cell')}
    </div>
  );
}

function renderHeader(column: any, className: string) {
  const headerProps = column.getHeaderProps(column.getSortByToggleProps());

  if (column.textAlign) {
    headerProps.style.textAlign = column.textAlign;
  }

  return (
    <div className={className} {...headerProps}>
      {column.render('Header')}
      <span>{column.isSorted ? (column.isSortedDesc ? ' 🔽' : ' 🔼') : ''}</span>
    </div>
  );
}

export const Table = ({ data, height, onCellClick, width }: Props) => {
  const theme = useTheme();
  const tableStyles = getTableStyles(theme);
  const { getTableProps, headerGroups, rows, prepareRow } = useTable(
    {
      columns: useMemo(() => getColumns(data, width, theme), [data]),
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
          {row.cells.map((cell: RenderCellProps) => renderCell(cell, tableStyles.tableCell, onCellClick))}
        </div>
      );
    },
    [prepareRow, rows]
  );

  return (
    <div {...getTableProps()} className={tableStyles.table}>
      <div>
        {headerGroups.map((headerGroup: any) => (
          <div className={tableStyles.thead} {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column: any) => renderHeader(column, tableStyles.headerCell))}
          </div>
        ))}
      </div>
      <FixedSizeList height={height} itemCount={rows.length} itemSize={tableStyles.cellHeight} width={width}>
        {RenderRow}
      </FixedSizeList>
    </div>
  );
};
