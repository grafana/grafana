import React, { useMemo } from 'react';
import { useTable, useBlockLayout, Column, TableOptions, Cell } from 'react-table';
import { DataFrame, DataFrameType, Field, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { Checkbox, Icon, useStyles2 } from '@grafana/ui';
import { FixedSizeList } from 'react-window';
import { TableCell } from '@grafana/ui/src/components/Table/TableCell';
import { getTableStyles } from '@grafana/ui/src/components/Table/styles';
import { DefaultCell } from '@grafana/ui/src/components/Table/DefaultCell';

type Props = {
  data: DataFrame;
  width: number;
};

type TableColumn = Column & {
  field?: Field;
};

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

const generateColumns = (
  access: FieldAccess,
  isDashboardList: boolean,
  availableWidth: number,
  styles: { [key: string]: string }
): TableColumn[] => {
  const columns: TableColumn[] = [];

  let width = Math.max(availableWidth * 0.2, 200);

  columns.push({
    id: `column-checkbox`,
    Header: () => (
      <div className={styles.checkboxHeader}>
        <Checkbox onChange={() => {}} />
      </div>
    ),
    Cell: () => (
      <div className={styles.checkbox}>
        <Checkbox onChange={() => {}} />
      </div>
    ),
    accessor: 'check',
    field: access.name!,
    width: 60,
  });

  columns.push({
    Cell: DefaultCell,
    id: `column-name`,
    field: access.name!,
    Header: 'Name',
    accessor: (row: any, i: number) => {
      const name = access.name!.values.get(i);
      return name;
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
            <Icon name={'apps'} className={styles.typeIcon} />
            Dashboard
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
        let txt = 'Dashboard';
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
          <div className={styles.typeText}>
            <Icon name={icon as any} className={styles.typeIcon} />
            {txt}
          </div>
        );
      },
      width,
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

  // React-table column definitions
  const access = useMemo(() => getFieldAccess(data), [data]);
  const memoizedColumns = useMemo(() => {
    const isDashboardList = data.meta?.type === DataFrameType.TimeSeriesLong;
    return generateColumns(access, isDashboardList, width, styles);
  }, [data.meta?.type, access, width, styles]);

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

      const url = access.url?.values.get(rowIndex);

      return (
        <div {...row.getRowProps({ style })} className={styles.rowContainer}>
          {row.cells.map((cell: Cell, index: number) => {
            if (cell.column.id === 'column-checkbox') {
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
            }

            return (
              <a href={url} key={index}>
                <div className={styles.cellWrapper}>
                  <TableCell
                    key={index}
                    tableStyles={tableStyles}
                    cell={cell}
                    columnIndex={index}
                    columnCount={row.cells.length}
                  />
                </div>
              </a>
            );
          })}
        </div>
      );
    },
    [rows, prepareRow, access.url?.values, styles.rowContainer, styles.cellWrapper, tableStyles]
  );

  return (
    <div {...getTableProps()} style={{ width }} aria-label={'Search result table'} role="table">
      <div>
        {headerGroups.map((headerGroup) => {
          const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();

          return (
            <div key={key} {...headerGroupProps} className={styles.headerRow}>
              {headerGroup.headers.map((column) => {
                const { key, ...headerProps } = column.getHeaderProps();
                return (
                  <div key={key} {...headerProps} role="columnheader" className={styles.headerCell}>
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

const getStyles = (theme: GrafanaTheme2) => {
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  return {
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
      > div {
        border: none !important;
      }
    `,
    headerCell: css`
      padding-top: 2px;
      padding-left: 10px;
    `,
    headerRow: css`
      background-color: ${theme.colors.background.secondary};
      height: 36px;
      align-items: center;
    `,
    rowContainer: css`
      &:hover {
        background-color: ${rowHoverBg};
      }
    `,
    typeIcon: css`
      margin-right: 9.5px;
    `,
    typeText: css`
      color: ${theme.colors.text.secondary};
    `,
    checkboxHeader: css`
      display: flex;
      justify-content: flex-start;
      width: 50px;
    `,
    checkbox: css`
      width: 55px;
      margin-left: 10px;
      margin-top: 5px;
    `,
  };
};
