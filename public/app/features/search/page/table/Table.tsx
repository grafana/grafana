import React, { useMemo } from 'react';
import { useTable, useBlockLayout, Column, TableOptions, Cell } from 'react-table';
import { DataFrame, DataFrameType, DataFrameView, DataSourceRef, Field, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { Checkbox, Icon, IconName, useStyles2 } from '@grafana/ui';
import { FixedSizeList } from 'react-window';
import { TableCell } from '@grafana/ui/src/components/Table/TableCell';
import { getTableStyles } from '@grafana/ui/src/components/Table/styles';
import { DefaultCell } from '@grafana/ui/src/components/Table/DefaultCell';
import { LocationInfo } from '../../service';
import { makeDataSourceColumn, makeTagsColumn, makeTypeColumn } from './columns';

type Props = {
  data: DataFrame;
  width: number;
};

export type TableColumn = Column & {
  field?: Field;
};

interface FieldAccess {
  kind: string; // panel, dashboard, folder
  name: string;
  description: string;
  url: string; // link to value (unique)
  type: string; // graph
  tags: string[];
  location: LocationInfo[]; // the folder name
  score: number;

  // Count info
  panelCount: number;
  dsList: DataSourceRef[];
}

const generateColumns = (
  data: DataFrameView<FieldAccess>,
  isDashboardList: boolean,
  availableWidth: number,
  styles: { [key: string]: string }
): TableColumn[] => {
  const columns: TableColumn[] = [];
  const urlField = data.fields.url!;
  const access = data.fields;

  availableWidth -= 8; // ???
  let width = 50;
  if (false) {
    // checkbox column
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
      field: urlField,
      width: 30,
    });
    availableWidth -= width;
  }

  // Name column
  width = Math.max(availableWidth * 0.2, 200);
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

    // Show tags if we have any
    if (access.tags && hasFieldValue(access.tags)) {
      width = 200;
      columns.push(makeTagsColumn(access.tags, width));
      availableWidth -= width;
    }

    // Show tags if we have any
    if (access.dsList && hasFieldValue(access.dsList)) {
      width = 200;
      columns.push(makeDataSourceColumn(access.dsList, width, styles.typeIcon));
      availableWidth -= width;
    }

    columns.push({
      Cell: DefaultCell,
      id: `column-info`,
      field: access.url!,
      Header: 'Info',
      accessor: (row: any, i: number) => {
        const panelCount = access.panelCount?.values.get(i);
        return <div className={styles.infoWrap}>{panelCount != null && <span>Panels: {panelCount}</span>}</div>;
      },
      width: Math.max(availableWidth, 100),
    });
  } else {
    // The type column
    width = 150;
    columns.push(makeTypeColumn(access.kind, access.type, width, styles.typeText, styles.typeIcon));
    availableWidth -= width;

    // Show tags if we have any
    if (access.tags && hasFieldValue(access.tags)) {
      width = 200;
      columns.push(makeTagsColumn(access.tags, width));
      availableWidth -= width;
    }

    // Show tags if we have any
    if (access.dsList && hasFieldValue(access.dsList)) {
      width = 200;
      columns.push(makeDataSourceColumn(access.dsList, width, styles.typeIcon));
      availableWidth -= width;
    }

    columns.push({
      Cell: DefaultCell,
      id: `column-location`,
      field: access.location ?? access.url,
      Header: 'Location',
      accessor: (row: any, i: number) => {
        const location = access.location?.values.get(i) as LocationInfo[];
        if (location) {
          return (
            <div>
              {location.map((v, id) => (
                <span
                  key={id}
                  className={styles.locationItem}
                  onClick={(e) => {
                    e.preventDefault();
                    alert('CLICK: ' + v.name);
                  }}
                >
                  <Icon name={getIconForKind(v.kind)} /> {v.name}
                </span>
              ))}
            </div>
          );
        }
        return null;
      },
      width: Math.max(availableWidth, 100),
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
  const access = useMemo(() => new DataFrameView<FieldAccess>(data), [data]);
  const memoizedColumns = useMemo(() => {
    const isDashboardList = data.meta?.type === DataFrameType.DirectoryListing;
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

      const url = access.fields.url?.values.get(rowIndex);

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
    [rows, prepareRow, access.fields.url?.values, styles.rowContainer, styles.cellWrapper, tableStyles]
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

function hasFieldValue(field: Field): boolean {
  for (let i = 0; i < field.values.length; i++) {
    const v = field.values.get(i);
    if (v && v.length) {
      return true;
    }
  }
  return false;
}

function getIconForKind(v: string): IconName {
  if (v === 'dashboard') {
    return 'apps';
  }
  if (v === 'folder') {
    return 'folder';
  }
  return 'question-circle';
}

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
      vertical-align: middle;
      display: inline-block;
      margin-bottom: ${theme.v1.spacing.xxs};
      fill: ${theme.colors.text.secondary};
    `,
    typeText: css`
      color: ${theme.colors.text.secondary};
    `,
    locationItem: css`
      color: ${theme.colors.text.secondary};
      margin-right: 12px;
    `,
    checkboxHeader: css`
      // display: flex;
      // justify-content: flex-start;
    `,
    checkbox: css`
      margin-left: 10px;
      margin-right: 10px;
      margin-top: 5px;
    `,
    infoWrap: css`
      span {
        margin-right: 10px;
      }
    `,
  };
};
