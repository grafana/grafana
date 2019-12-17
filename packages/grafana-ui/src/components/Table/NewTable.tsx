import React, { useMemo } from 'react';
import { DataFrame, GrafanaTheme } from '@grafana/data';
// @ts-ignore
import { useBlockLayout, useSortBy, useTable } from 'react-table';
import { FixedSizeList } from 'react-window';
import { css } from 'emotion';
import { stylesFactory, useTheme, selectThemeVariant as stv } from '../../themes';

export interface Props {
  data: DataFrame;
  width: number;
  height: number;
  onCellClick?: (key: string, value: string) => void;
}

const getTableData = (data: DataFrame) => {
  const tableData = [];

  for (let i = 0; i < data.length; i++) {
    const row: { [key: string]: string | number } = {};
    for (let j = 0; j < data.fields.length; j++) {
      const prop = data.fields[j].name;
      row[prop] = data.fields[j].values.get(i);
    }
    tableData.push(row);
  }

  return tableData;
};

const getColumns = (data: DataFrame) => {
  return data.fields.map(field => {
    return {
      Header: field.name,
      accessor: field.name,
      field: field,
    };
  });
};

const getTableStyles = stylesFactory((theme: GrafanaTheme, columnWidth: number) => {
  const colors = theme.colors;
  const headerBg = stv({ light: colors.gray6, dark: colors.dark7 }, theme.type);
  const padding = 5;

  return {
    cellHeight: padding * 2 + 14 * 1.5 + 2,
    tableHeader: css`
      padding: ${padding}px 10px;
      background: ${headerBg};

      cursor: pointer;
      white-space: nowrap;

      color: ${colors.blue};
      border-bottom: 2px solid ${colors.bodyBg};
    `,
    tableCell: css`
      display: 'table-cell';
      padding: ${padding}px 10px;

      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      width: ${columnWidth}px;

      border-right: 2px solid ${colors.bodyBg};
      border-bottom: 2px solid ${colors.bodyBg};
    `,
  };
});

const renderCell = (cell: any, columnWidth: number, cellStyles: string, onCellClick?: any) => {
  const filterable = cell.column.field.config.filterable;
  const style = {
    cursor: `${filterable && onCellClick ? 'pointer' : 'default'}`,
  };

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
      columns: useMemo(() => getColumns(data), [data]),
      data: useMemo(() => getTableData(data), [data]),
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
