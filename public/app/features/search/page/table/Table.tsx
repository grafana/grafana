import React, { useMemo } from 'react';
import { useTable, useBlockLayout, Column, TableOptions, Cell } from 'react-table';
import { DataFrame, DataFrameType, DataFrameView, DataSourceRef, Field, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { FixedSizeList } from 'react-window';
import { TableCell } from '@grafana/ui/src/components/Table/TableCell';
import { getTableStyles } from '@grafana/ui/src/components/Table/styles';

import { LocationInfo } from '../../service';
import { generateColumns } from './columns';

type Props = {
  data: DataFrame;
  width: number;
  tags: string[];
  onTagFilterChange: (tags: string[]) => void;
  onDatasourceChange: (datasource?: string) => void;
};

export type TableColumn = Column & {
  field?: Field;
};

export interface FieldAccess {
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
  datasource: DataSourceRef[];
}

export const Table = ({ data, width, tags, onTagFilterChange, onDatasourceChange }: Props) => {
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
    return generateColumns(access, isDashboardList, width, styles, tags, onTagFilterChange, onDatasourceChange);
  }, [data.meta?.type, access, width, styles, tags, onTagFilterChange, onDatasourceChange]);

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
            if (
              cell.column.id === 'column-checkbox' ||
              cell.column.id === 'column-tags' ||
              cell.column.id === 'column-datasource'
            ) {
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
    tagList: css`
      justify-content: flex-start;
      pointer-events: auto;
    `,
  };
};
