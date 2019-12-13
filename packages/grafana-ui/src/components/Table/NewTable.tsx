import React, { useMemo } from 'react';
import { DataFrame, GrafanaTheme } from '@grafana/data';
// @ts-ignore
import { useBlockLayout, useSortBy, useTable } from 'react-table';
import { FixedSizeList } from 'react-window';
import { css } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';

export interface Props {
  data: DataFrame;
  width: number;
  height: number;
  onCellClick?: any;
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
    };
  });
};

const getTableStyles = stylesFactory((theme: GrafanaTheme) => {
  const colors = theme.colors;

  return {
    tableHeader: css`
      padding: 3px 10px;

      background: linear-gradient(135deg, ${colors.dark8}, ${colors.dark6});
      border-top: 2px solid ${colors.bodyBg};
      border-bottom: 2px solid ${colors.bodyBg};

      cursor: pointer;
      white-space: nowrap;

      color: ${colors.blue};
    `,
    tableCell: css`
      padding: 3px 10px;

      background: linear-gradient(180deg, ${colors.dark5} 10px, ${colors.dark2} 100px);

      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;

      border-right: 2px solid ${colors.bodyBg};
      border-bottom: 2px solid ${colors.bodyBg};
    `,
  };
});

export const NewTable = ({ data, height, onCellClick, width }: Props) => {
  const theme = useTheme();
  const tableStyles = getTableStyles(theme);
  const columnWidth = Math.floor(width / data.fields.length);
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
        <div
          {...row.getRowProps({
            style,
          })}
        >
          {row.cells.map((cell: any) => {
            return (
              <div
                className={tableStyles.tableCell}
                {...cell.getCellProps()}
                onClick={() => onCellClick(cell.column.Header, cell.value)}
                style={{
                  display: 'table-cell',
                  width: `${columnWidth}px`,
                  cursor: `${onCellClick ? 'pointer' : 'default'}`,
                }}
              >
                {cell.render('Cell')}
              </div>
            );
          })}
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
      <FixedSizeList height={height} itemCount={rows.length} itemSize={27} width={width}>
        {RenderRow}
      </FixedSizeList>
    </div>
  );
};
