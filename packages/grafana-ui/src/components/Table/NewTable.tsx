import React from 'react';
import { DataFrame } from '@grafana/data';
// @ts-ignore
import { useBlockLayout, useSortBy, useTable } from 'react-table';
import { FixedSizeList } from 'react-window';

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

export const NewTable = ({ data }: Props) => {
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
          className="tr"
        >
          {row.cells.map((cell: any) => {
            return (
              <div {...cell.getCellProps()} className="td">
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
              <div className="gf-table-header" {...column.getHeaderProps(column.getSortByToggleProps())}>
                {column.render('Header')}
                <span>{column.isSorted ? (column.isSortedDesc ? ' 🔽' : ' 🔼') : ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div {...getTableBodyProps()}>
        <FixedSizeList height={400} itemCount={rows.length} itemSize={35} width={totalColumnsWidth}>
          {RenderRow}
        </FixedSizeList>
      </div>
    </div>
  );
};
