import React from 'react';
import { DataFrame, GrafanaTheme } from '@grafana/data';
import { useTable } from 'react-table';
import { stylesFactory, useTheme } from '../../themes';

export interface Props {
  data: DataFrame;
}

const getTableStyles = stylesFactory((theme: GrafanaTheme) => {
  return {};
});

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
  const theme = useTheme();
  const styles = getTableStyles(theme);

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable({
    columns: React.useMemo(() => getColumns(data), []),
    data: React.useMemo(() => getTableData(data), []),
  });

  return (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th className="gf-table-header" {...column.getHeaderProps()}>
                {column.render('Header')}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map(row => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps()}>
              {row.cells.map(cell => {
                return (
                  <td className="gf-table-cell" {...cell.getCellProps()}>
                    {cell.render('Cell')}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
