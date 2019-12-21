import React, { useMemo } from 'react';
import { DataFrame } from '@grafana/data';
// @ts-ignore
import { useSortBy, useTable, useFlexLayout } from 'react-table';
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

const renderCell = (cell: any, cellStyles: string, onCellClick?: any) => {
  const filterable = cell.column.field.config.filterable;
  const cellProps = cell.getCellProps();
  let onClick: ((event: React.SyntheticEvent) => void) | undefined = undefined;

  if (filterable && onCellClick) {
    cellProps.style.cursor = 'pointer';
    onClick = () => onCellClick(cell.column.Header, cell.value);
  }

  return (
    <div className={cellStyles} {...cell.getCellProps()} onClick={onClick}>
      {cell.render('Cell')}
    </div>
  );
};

export const NewTable = ({ data, height, onCellClick, width }: Props) => {
  const theme = useTheme();
  const tableStyles = getTableStyles(theme);
  const { getTableProps, headerGroups, rows, prepareRow } = useTable(
    {
      columns: useMemo(() => getColumns(data, theme), [data]),
      data: useMemo(() => getTableRows(data), [data]),
    },
    useSortBy,
    useFlexLayout
  );

  const RenderRow = React.useCallback(
    ({ index, style }) => {
      const row = rows[index];
      prepareRow(row);
      return (
        <div {...row.getRowProps({ style })}>
          {row.cells.map((cell: any) => renderCell(cell, tableStyles.tableCell, onCellClick))}
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
            {headerGroup.headers.map((column: any) => (
              <div className={tableStyles.headerCell} {...column.getHeaderProps(column.getSortByToggleProps())}>
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
