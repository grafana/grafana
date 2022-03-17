import React, { useCallback, useMemo } from 'react';
import { useTable, useBlockLayout, Column } from 'react-table';
import { DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { FixedSizeList } from 'react-window';
import { TableCell } from '@grafana/ui/src/components/Table/TableCell';
import { getTableStyles } from '@grafana/ui/src/components/Table/styles';
import { DefaultCell } from '@grafana/ui/src/components/Table/DefaultCell';

type Props = {
  data: DataFrame;
  width: number;
};

type TableColumn = Column & {
  field: Field;
};

const generateColumns = (data: DataFrame, availableWidth: number): TableColumn[] => {
  const columns: TableColumn[] = [];

  for (const [fieldIndex, field] of data.fields.entries()) {
    columns.push({
      Cell: DefaultCell,
      id: fieldIndex.toString(),
      field: field,
      Header: field.name,
      accessor: (row: any, i: number) => {
        return field.values.get(i);
      },
    });
  }

  return columns;
};

export const Table = ({ data, width }: Props) => {
  const styles = useStyles2(getStyles);
  const tableStyles = useStyles2(getTableStyles);

  const memoizedData = useMemo(() => {
    if (!data.fields.length) {
      return [];
    }
    // as we only use this to fake the length of our data set for react-table we need to make sure we always return an array
    // filled with values at each index otherwise we'll end up trying to call accessRow for null|undefined value in
    // https://github.com/tannerlinsley/react-table/blob/7be2fc9d8b5e223fc998af88865ae86a88792fdb/src/hooks/useTable.js#L585
    return Array(data.length).fill(0);
  }, [data]);

  console.log(memoizedData, 'getting here?');

  // React-table column definitions
  const memoizedColumns = useMemo(() => generateColumns(data, width), [data, width]);

  const options: any = useMemo(
    () => ({
      columns: memoizedColumns,
      data: memoizedData,
    }),
    [memoizedColumns, memoizedData]
  );

  const { getTableProps, getTableBodyProps, headerGroups, rows, totalColumnsWidth, prepareRow } = useTable(
    options,
    useBlockLayout
  );

  const RenderRow = React.useCallback(
    ({ index: rowIndex, style }) => {
      const row = rows[rowIndex];
      prepareRow(row);
      console.log(row);
      return (
        <div {...row.getRowProps({ style })} className={tableStyles.row}>
          {row.cells.map((cell: Cell, index: number) => {
            return (
              <TableCell
                key={index}
                tableStyles={tableStyles}
                cell={cell}
                columnIndex={index}
                columnCount={row.cells.length}
              />
            );
          })}
        </div>
      );
    },
    [prepareRow, rows, tableStyles]
  );

  //   if (!count || !hasFields) {
  //     return <div className={styles.noData}>No data</div>;
  //   }

  return (
    <div {...getTableProps()} className="table">
      <div>
        {headerGroups.map((headerGroup) => (
          <div {...headerGroup.getHeaderGroupProps()} className="tr">
            {headerGroup.headers.map((column) => (
              <div {...column.getHeaderProps()} className="th">
                {column.render('Header')}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div {...getTableBodyProps()}>
        {rows.length > 0 ? (
          <FixedSizeList height={400} itemCount={rows.length} itemSize={35} width={totalColumnsWidth}>
            {RenderRow}
          </FixedSizeList>
        ) : (
          <div className={styles.noData}>No data</div>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  `,
  noData: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  `,
  selectWrapper: css`
    padding: 8px;
  `,
});
