import React, { useMemo } from 'react';
import { useTable, useBlockLayout, Column, TableOptions, Cell } from 'react-table';
import { DataFrame, DataFrameType, Field, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { Icon, useStyles2 } from '@grafana/ui';
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
  const isDashboardList = data.meta?.type === DataFrameType.TimeSeriesLong;

  let width = Math.max(availableWidth * 0.2, 200);
  const access = getFieldAccess(data);
  columns.push({
    Cell: DefaultCell,
    id: `column-name`,
    field: access.name!,
    Header: 'Name',
    accessor: (row: any, i: number) => {
      const url = access.url!.values.get(i);
      const name = access.name!.values.get(i);
      return <a href={url}>{name}</a>;
    },
    width,
  });
  availableWidth -= width;

  if (isDashboardList) {
    // The type column
    width = 150;
    columns.push({
      Cell: DefaultCell,
      id: `column-type`,
      field: access.name!,
      Header: 'Type',
      accessor: (row: any, i: number) => {
        return (
          <div>
            <Icon name={'apps'} />
            &nbsp; dashboard
          </div>
        );
      },
      width,
    });
    availableWidth -= width;

    // tags...
    columns.push({
      Cell: DefaultCell,
      id: `column-tags`,
      field: access.name!,
      Header: 'Tags',
      accessor: (row: any, i: number) => {
        return <div>[TAGS]</div>;
      },
      width,
    });
  } else {
    // The type column
    width = 150;
    columns.push({
      Cell: DefaultCell,
      id: `column-type`,
      field: access.kind ?? access.url!,
      Header: 'Type',
      accessor: (row: any, i: number) => {
        let icon = 'apps';
        let txt = 'dashboard';
        if (access.kind) {
          txt = access.kind.values.get(i);
          switch (txt) {
            case 'dashboard':
              icon = 'apps';
              break;
            case 'folder':
              icon = 'folder';
              break;
            case 'panel':
              icon = 'graph-bar';
              txt = access.type?.values.get(i) ?? txt;
          }
        }
        return (
          <div>
            <Icon name={icon as any} />
            &nbsp;
            {txt}
          </div>
        );
      },
      width,
    });
    availableWidth -= width;

    if (availableWidth > 0) {
      columns.push({
        Cell: DefaultCell,
        id: `column-url`,
        field: access.url!,
        Header: 'URL',
        accessor: (row: any, i: number) => {
          const url = access.url!.values.get(i);
          return <a href={url}>{url}</a>;
        },
        width: availableWidth,
      });
    }
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

  // React-table column definitions
  const memoizedColumns = useMemo(() => generateColumns(data, width), [data, width]);

  const options: TableOptions<{}> = useMemo(
    () => ({
      columns: memoizedColumns,
      data: memoizedData,
    }),
    [memoizedColumns, memoizedData]
  );

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(options, useBlockLayout);

  const RenderRow = React.useCallback(
    ({ index: rowIndex, style }) => {
      const row = rows[rowIndex];
      prepareRow(row);

      return (
        <div {...row.getRowProps({ style })} className={tableStyles.row}>
          {row.cells.map((cell: Cell, index: number) => {
            return (
              <div key={index} className={styles.cellWrapper}>
                <TableCell
                  key={index}
                  tableStyles={tableStyles}
                  cell={cell}
                  columnIndex={index}
                  columnCount={row.cells.length}
                />
              </div>
            );
          })}
        </div>
      );
    },
    [prepareRow, rows, tableStyles, styles.cellWrapper]
  );

  return (
    <div {...getTableProps()} style={{ width }} aria-label={'Search result table'} role="table">
      <div>
        {headerGroups.map((headerGroup) => {
          const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();

          return (
            <div key={key} {...headerGroupProps}>
              {headerGroup.headers.map((column) => {
                const { key, ...headerProps } = column.getHeaderProps();
                return (
                  <div key={key} {...headerProps} role="columnheader" className={tableStyles.headerCell}>
                    {column.render('Header')}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div {...getTableBodyProps()}>
        {rows.length > 0 ? (
          <FixedSizeList
            height={500}
            itemCount={rows.length}
            itemSize={tableStyles.rowHeight}
            width={'100%'}
            className={styles.tableBody}
          >
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
  noData: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
  `,
  table: css`
    width: 100%;
  `,
  tableBody: css`
    overflow: 'hidden auto';
  `,
  cellIcon: css`
    display: flex;
    align-items: center;
  `,
  cellWrapper: css`
    display: flex;
  `,
});

interface FieldAccess {
  kind?: Field<string>; // panel, dashboard, folder
  name?: Field<string>;
  description?: Field<string>;
  url?: Field<string>; // link to value (unique)
  type?: Field<string>; // graph
  tags?: Field<any>;
  location?: Field<string>; // the folder name
  score?: Field<number>;
}

function getFieldAccess(frame: DataFrame): FieldAccess {
  const a: FieldAccess = {};
  for (const f of frame.fields) {
    switch (f.name.toLowerCase()) {
      case 'name':
        a.name = f;
        break;
      case 'kind':
        a.kind = f;
        break;
      case 'location':
        a.location = f;
        break;
      case 'type':
        a.type = f;
        break;
      case 'url':
        a.url = f;
        break;
    }
  }
  return a;
}
