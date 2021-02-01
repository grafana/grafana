import React, { FC, useMemo, useState } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { stylesFactory, useTheme } from '../../themes';
import { Icon } from '../Icon/Icon';

interface TableColumn {
  name: string;
  render?: (data: any, i: number, row: any[]) => React.ReactNode;
  sortable?: boolean;
  sortKey?: (data: string) => string;
}

export interface Props {
  headers: TableColumn[];
  rows: any[][];
  tableClass?: string;
}

enum SortDirection {
  Ascending = 'ascending',
  Descending = 'descending',
  None = 'none',
}

export const NewTable: FC<Props> = (props: Props) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [sortingColumn, setSortingColumn] = useState<number | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.None);
  const [rows, setRows] = useState<string[][]>(props.rows);
  useMemo(() => {
    if (sortingColumn === undefined || sortDirection === SortDirection.None) {
      return setRows(props.rows.slice(0));
    }

    setRows(
      rows.slice(0).sort((a, b) => {
        const ascending = sortDirection === SortDirection.Ascending;
        if (a[sortingColumn] > b[sortingColumn]) {
          return ascending ? 1 : -1;
        } else if (a[sortingColumn] < b[sortingColumn]) {
          return ascending ? -1 : 1;
        }

        return 0;
      })
    );
  }, [props.rows, sortDirection, sortingColumn]);

  const sortColumn = (colID: number) => {
    if (props.headers[colID].sortable === false) {
      return;
    }

    if (colID !== sortingColumn) {
      setSortDirection(SortDirection.Ascending);
    } else {
      if (sortDirection === SortDirection.None) {
        setSortDirection(SortDirection.Ascending);
      } else if (sortDirection === SortDirection.Ascending) {
        setSortDirection(SortDirection.Descending);
      } else {
        setSortDirection(SortDirection.None);
      }
    }
    setSortingColumn(colID);
  };

  return (
    <table className={cx(styles.dataTable, props.tableClass)}>
      <thead>
        <tr className={styles.rowHeader}>
          {props.headers.map((header, i) => (
            <th
              scope="col"
              role="columnheader"
              aria-sort={sortingColumn === i && sortDirection !== SortDirection.None ? sortDirection : undefined}
              onClick={() => sortColumn(i)}
              key={i}
            >
              {header.name}
              {sortingColumn === i && sortDirection !== SortDirection.None && (
                <Icon name={sortDirection === SortDirection.Ascending ? 'arrow-up' : 'arrow-down'} />
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{props.headers[j]?.render?.(cell, i, row) ?? cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

NewTable.displayName = 'NewTable';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    rowHeader: css`
      font-size: ${theme.typography.size.sm};
      color: #538ade;
      height: 36px;
      min-height: 36px;
      max-height: 36px;
      > th {
        height: 36px;
        min-height: 36px;
        max-height: 36px;
      }

      > th:hover {
        color: #7096d0;
        cursor: pointer;
        user-select: none;
      }
    `,

    dataTable: css`
      font-size: ${theme.typography.size.md};
      border-radius: 2px;
      border: 1px solid #343b40;
      background: ${theme.colors.panelBg};
      color: ${theme.colors.textSemiWeak};
      td,
      th {
        padding: 9px;
      }

      tbody > tr:nth-child(odd) {
        background: ${theme.colors.panelBorder};
      }
    `,
  };
});
