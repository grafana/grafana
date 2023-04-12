import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { CellProps, Column, TableInstance, useTable } from 'react-table';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, useStyles2 } from '@grafana/ui';

import { DashboardsTreeItem, INDENT_AMOUNT_CSS_VAR } from '../types';

import { NameCell } from './NameCell';
import { TypeCell } from './TypeCell';

interface DashboardsTreeProps {
  items: DashboardsTreeItem[];
  width: number;
  height: number;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
}

type DashboardsTreeColumn = Column<DashboardsTreeItem>;

const HEADER_HEIGHT = 35;
const ROW_HEIGHT = 35;

export function DashboardsTree({ items, width, height, onFolderClick }: DashboardsTreeProps) {
  const styles = useStyles2(getStyles);

  const tableColumns = useMemo(() => {
    const checkboxColumn: DashboardsTreeColumn = {
      id: 'checkbox',
      Header: () => <Checkbox value={false} />,
      Cell: () => <Checkbox value={false} />,
    };

    const nameColumn: DashboardsTreeColumn = {
      id: 'name',
      Header: <span style={{ paddingLeft: 20 }}>Name</span>,
      Cell: (props: CellProps<DashboardsTreeItem, unknown>) => <NameCell {...props} onFolderClick={onFolderClick} />,
    };

    const typeColumn: DashboardsTreeColumn = {
      id: 'type',
      Header: 'Type',
      Cell: TypeCell,
    };

    return [checkboxColumn, nameColumn, typeColumn];
  }, [onFolderClick]);

  const table = useTable({ columns: tableColumns, data: items });
  const { getTableProps, getTableBodyProps, headerGroups } = table;

  return (
    <div {...getTableProps()} className={styles.tableRoot} role="table">
      {headerGroups.map((headerGroup) => {
        const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps({
          style: { width },
        });

        return (
          <div key={key} {...headerGroupProps} className={cx(styles.row, styles.headerRow)}>
            {headerGroup.headers.map((column) => {
              const { key, ...headerProps } = column.getHeaderProps();

              return (
                <div key={key} {...headerProps} role="columnheader" className={styles.cell}>
                  {column.render('Header')}
                </div>
              );
            })}
          </div>
        );
      })}

      <div {...getTableBodyProps()}>
        <List
          height={height - HEADER_HEIGHT}
          width={width}
          itemCount={items.length}
          itemData={table}
          itemSize={ROW_HEIGHT}
        >
          {VirtualListRow}
        </List>
      </div>
    </div>
  );
}

interface VirtualListRowProps {
  index: number;
  style: React.CSSProperties;
  data: TableInstance<DashboardsTreeItem>;
}

function VirtualListRow({ index, style, data: table }: VirtualListRowProps) {
  const styles = useStyles2(getStyles);
  const { rows, prepareRow } = table;

  const row = rows[index];
  prepareRow(row);

  return (
    <div {...row.getRowProps({ style })} className={cx(styles.row, styles.bodyRow)}>
      {row.cells.map((cell) => {
        const { key, ...cellProps } = cell.getCellProps();

        return (
          <div key={key} {...cellProps} className={styles.cell}>
            {cell.render('Cell')}
          </div>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const columnSizing = 'auto 2fr 1fr';

  return {
    tableRoot: css({
      // The Indented component uses this css variable to indent items to their position
      // in the tree
      [INDENT_AMOUNT_CSS_VAR]: theme.spacing(1),

      [theme.breakpoints.up('md')]: {
        [INDENT_AMOUNT_CSS_VAR]: theme.spacing(3),
      },
    }),

    cell: css({
      padding: theme.spacing(1),
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),

    row: css({
      display: 'grid',
      gridTemplateColumns: columnSizing,
      alignItems: 'center',
    }),

    headerRow: css({
      backgroundColor: theme.colors.background.secondary,
      height: HEADER_HEIGHT,
    }),

    bodyRow: css({
      height: ROW_HEIGHT,

      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
    }),

    link: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
