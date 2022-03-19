import React, { useMemo } from 'react';
import { useTable, useBlockLayout, Column, TableOptions, Cell } from 'react-table';
import { DataFrame, Field, getFieldDisplayName, GrafanaTheme2, Vector } from '@grafana/data';
import { css } from '@emotion/css';
import { Icon, TableFieldOptions, useStyles2 } from '@grafana/ui';
import { FixedSizeList } from 'react-window';
import { TableCell } from '@grafana/ui/src/components/Table/TableCell';
import { getTableStyles } from '@grafana/ui/src/components/Table/styles';
import { getCellComponent } from '@grafana/ui/src/components/Table/utils';

type Props = {
  data: DataFrame;
  width: number;
};

type TableColumn = Column & {
  field: Field;
};

const SEARCH_COLUMNS = ['Name'];

const generateColumns = (data: DataFrame, availableWidth: number): TableColumn[] => {
  const columns: TableColumn[] = [];

  for (const [fieldIndex, field] of data.fields.entries()) {
    if (SEARCH_COLUMNS.includes(getFieldDisplayName(field, data))) {
      const fieldTableOptions = (field.config.custom || {}) as TableFieldOptions;
      const Cell = getCellComponent(fieldTableOptions.displayMode, field);
      columns.push({
        Cell: Cell,
        id: fieldIndex.toString(),
        field: field,
        Header: getFieldDisplayName(field, data),
        accessor: (row: any, i: number) => {
          return field.values.get(i);
        },
        width: fieldTableOptions.width,
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

      let nameField: Field<any, Vector<any>> | undefined = undefined;
      let kindField: Field<any, Vector<any>> | undefined = undefined;
      let urlField: Field<any, Vector<any>> | undefined = undefined;
      for (const [_, field] of data.fields.entries()) {
        const fieldDisplayName = field.name;
        if (SEARCH_COLUMNS.includes(fieldDisplayName)) {
          nameField = field;
        }

        if (fieldDisplayName === 'Kind') {
          kindField = field;
        }

        if (fieldDisplayName === 'URL') {
          urlField = field;
        }

        if (nameField && kindField && urlField) {
          break;
        }
      }

      return (
        <div {...row.getRowProps({ style })} className={tableStyles.row}>
          {row.cells.map((cell: Cell, index: number) => {
            const valueIndex = nameField?.values.toArray().findIndex((value: Vector<any>, index) => {
              if (value === cell.value) {
                return index;
              }
              return;
            });

            const kind = kindField?.values.get(valueIndex!);
            const url = urlField?.values.get(valueIndex!);

            const icon = kind === 'dashboard' ? kind : kind === 'panel' ? 'graph-bar' : 'question-circle';

            return (
              <div key={index} className={styles.cellWrapper}>
                {kind && (
                  <div className={styles.cellIcon}>
                    <Icon name={icon} size={'xl'} />
                  </div>
                )}
                <a href={url}>
                  <TableCell
                    key={index}
                    tableStyles={tableStyles}
                    cell={cell}
                    columnIndex={index}
                    columnCount={row.cells.length}
                  />
                </a>
              </div>
            );
          })}
        </div>
      );
    },
    [prepareRow, rows, tableStyles, data, styles.cellIcon, styles.cellWrapper]
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
