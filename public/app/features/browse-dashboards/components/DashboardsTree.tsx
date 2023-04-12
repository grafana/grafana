import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { CellProps, Column, TableInstance, useTable } from 'react-table';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

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
const ITEM_HEIGHT = 35;

export function DashboardsTree({ items, width, height, onFolderClick }: DashboardsTreeProps) {
  const styles = useStyles2(getStyles);

  const tableColumns = useMemo(() => {
    const checkboxColumn: DashboardsTreeColumn = {
      id: 'checkbox',
      Header: () => <input type="checkbox" />,
      Cell: () => <input type="checkbox" />,
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
          <div key={key} {...headerGroupProps} className={styles.headerRow}>
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
          itemSize={ITEM_HEIGHT}
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
    <div {...row.getRowProps({ style })} className={styles.rowContainer}>
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
  return {
    tableRoot: css({
      [INDENT_AMOUNT_CSS_VAR]: `24px`,
    }),

    cell: css({
      padding: theme.spacing(1),
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),

    headerRow: css({
      label: 'header-row',
      display: 'grid',
      gridTemplateColumns: 'auto 2fr 1fr',
      backgroundColor: theme.colors.background.secondary,
      height: HEADER_HEIGHT,
    }),

    rowContainer: css({
      display: 'grid',
      gridTemplateColumns: 'auto 2fr 1fr',

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
