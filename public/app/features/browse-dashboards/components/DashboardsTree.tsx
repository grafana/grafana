import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { CellProps, Column, TableInstance, useTable } from 'react-table';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, Link, useStyles2 } from '@grafana/ui';
import { getIconForKind } from 'app/features/search/service/utils';
import { DashboardViewItem as OrigDashboardViewItem } from 'app/features/search/types';

interface UIDashboardViewItem {
  kind: 'ui-empty-folder';
}

type DashboardViewItem = OrigDashboardViewItem | UIDashboardViewItem;

export interface DashboardsTreeItem {
  item: DashboardViewItem;
  level: number;
  isOpen: boolean;
}

interface DashboardsTreeProps {
  items: DashboardsTreeItem[];
  width: number;
  height: number;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
}

interface VirtualListData {
  items: DashboardsTreeItem[];
  tableInstance: TableInstance<DashboardsTreeItem>;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
}

type DashboardsTreeColumn = Column<DashboardsTreeItem>;

const HEADER_HEIGHT = 35;
const ITEM_HEIGHT = 35;
const INDENT_AMOUNT_CSS_VAR = '--dashboards-tree-indentation';

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
      accessor: (row) => row,
      Header: <span style={{ paddingLeft: 20 }}>Name</span>,
      Cell: (props: CellProps<DashboardsTreeItem, unknown>) => <NameCell {...props} onFolderClick={onFolderClick} />,
    };

    const typeColumn: DashboardsTreeColumn = {
      id: 'type',
      accessor: (row) => row.item.kind,
      Header: 'Type',
      Cell: TypeCell,
    };

    return [checkboxColumn, nameColumn, typeColumn];
  }, [onFolderClick]);

  const tableInstance = useTable({ columns: tableColumns, data: items });
  const { getTableProps, getTableBodyProps, headerGroups } = tableInstance;

  const virtualData = useMemo((): VirtualListData => {
    return {
      items,
      tableInstance,
      onFolderClick,
    };
  }, [items, tableInstance, onFolderClick]);

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
          itemData={virtualData}
          itemSize={ITEM_HEIGHT}
        >
          {Row}
        </List>
      </div>
    </div>
  );
}

type TypeCellProps = CellProps<DashboardsTreeItem, unknown>;

function TypeCell({ row: { original: data } }: TypeCellProps) {
  const iconName = getIconForKind(data.item.kind);

  switch (data.item.kind) {
    case 'dashboard':
      return (
        <>
          <Icon name={iconName} /> Dashboard
        </>
      );
    case 'folder':
      return (
        <>
          <Icon name={iconName} /> Folder
        </>
      );
    case 'panel':
      return (
        <>
          <Icon name={iconName} /> Panel
        </>
      );
    default:
      return null;
  }
}

type NameCellProps = CellProps<DashboardsTreeItem, unknown> & {
  onFolderClick: (uid: string, newOpenState: boolean) => void;
};

function NameCell({ row: { original: data }, onFolderClick }: NameCellProps) {
  const styles = useStyles2(getStyles);
  const { item, level, isOpen } = data;

  let body = <></>;

  if (item.kind === 'ui-empty-folder') {
    body = <em>Empty folder</em>;
  } else {
    body = (
      <>
        {item.kind === 'folder' ? (
          <IconButton onClick={() => onFolderClick(item.uid, !isOpen)} name={isOpen ? 'angle-down' : 'angle-right'} />
        ) : (
          <span style={{ paddingRight: 20 }} />
        )}
        <Icon name={item.kind === 'folder' ? (isOpen ? 'folder-open' : 'folder') : 'apps'} />{' '}
        <Link
          href={item.kind === 'folder' ? `/nested-dashboards/f/${item.uid}` : `/d/${item.uid}`}
          className={styles.link}
        >
          {item.title}
        </Link>
      </>
    );
  }

  return <span style={{ paddingLeft: `calc(var(${INDENT_AMOUNT_CSS_VAR}) * ${level})` }}>{body}</span>;
}

const Row = ({ index, style, data }: { index: number; style: React.CSSProperties; data: VirtualListData }) => {
  const styles = useStyles2(getStyles);
  const { rows, prepareRow } = data.tableInstance;

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
};

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
