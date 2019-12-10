import React from 'react';
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

export const NewTable = ({ data }: Props) => {
  const theme = useTheme();
  const tableStyles = getTableStyles(theme);
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow, totalColumnsWidth } = useTable(
    {
      columns: React.useMemo(() => getColumns(data), []),
      data: React.useMemo(() => getTableData(data), []),
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
              <div className={tableStyles.tableCell} {...cell.getCellProps()}>
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
          <div {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column: any) => (
              <div className={tableStyles.tableHeader} {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                <span>{column.isSorted ? (column.isSortedDesc ? ' 🔽' : ' 🔼') : ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div {...getTableBodyProps()}>
        <FixedSizeList height={400} itemCount={rows.length} itemSize={27} width={totalColumnsWidth}>
          {RenderRow}
        </FixedSizeList>
      </div>
    </div>
  );
};
