import { css, cx } from '@emotion/css';
import { useCallback, useId, useMemo } from 'react';
import { TableInstance, useTable } from 'react-table';
import { List, type RowComponentProps } from 'react-window';
import { useInfiniteLoader } from 'react-window-infinite-loader';

import { GrafanaTheme2, isTruthy } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { DashboardViewItem } from 'app/features/search/types';

import {
  DashboardsTreeCellProps,
  DashboardsTreeColumn,
  DashboardsTreeItem,
  SelectionState,
  BrowseDashboardsPermissions,
} from '../types';

import CheckboxCell from './CheckboxCell';
import CheckboxHeaderCell from './CheckboxHeaderCell';
import { NameCell } from './NameCell';
import { TagsCell } from './TagsCell';
import { useCustomFlexLayout } from './customFlexTableLayout';
import { makeRowID, canSelectItems } from './utils';

interface DashboardsTreeProps {
  items: DashboardsTreeItem[];
  width: number;
  height: number;
  permissions: BrowseDashboardsPermissions;
  isSelected: (kind: DashboardViewItem | '$all') => SelectionState;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
  onAllSelectionChange: (newState: boolean) => void;
  onItemSelectionChange: (item: DashboardViewItem, newState: boolean) => void;
  onTagClick: (tag: string) => void;

  isItemLoaded: (itemIndex: number) => boolean;
  requestLoadMore: (folderUid: string | undefined) => void;
}

const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 36;
const DIVIDER_HEIGHT = 0; // Yes - make it appear as a border on the row rather than a row itself

function getRowHeight(rowIndex: number, { items }: VirtualListRowProps) {
  const row = items[rowIndex];
  if (row.item.kind === 'ui' && row.item.uiKind === 'divider') {
    return DIVIDER_HEIGHT;
  }

  return ROW_HEIGHT;
}

export function DashboardsTree({
  items,
  width,
  height,
  isSelected,
  onFolderClick,
  onTagClick,
  onAllSelectionChange,
  onItemSelectionChange,
  isItemLoaded,
  requestLoadMore,
  permissions,
}: DashboardsTreeProps) {
  const treeID = useId();
  const styles = useStyles2(getStyles);

  // TODO verify if we need this with v2
  // useEffect(() => {
  //   // If the tree changed identity, then some indexes that were previously loaded may now be unloaded,
  //   // especially after a refetch after a move/delete.
  //   // Clear that cache, and check if we need to trigger another load
  //   if (infiniteLoaderRef.current) {
  //     infiniteLoaderRef.current.resetloadMoreItemsCache(true);
  //   }

  //   if (listRef.current) {
  //     listRef.current.resetAfterIndex(0);
  //   }
  // }, [items]);

  const tableColumns = useMemo(() => {
    const checkboxColumn: DashboardsTreeColumn = {
      id: 'checkbox',
      width: 0,
      Header: CheckboxHeaderCell,
      Cell: CheckboxCell,
    };

    const nameColumn: DashboardsTreeColumn = {
      id: 'name',
      width: 3,
      Header: (
        <span style={{ paddingLeft: 24 }}>
          <Trans i18nKey="browse-dashboards.dashboards-tree.name-column">Name</Trans>
        </span>
      ),
      Cell: (props: DashboardsTreeCellProps) => <NameCell {...props} onFolderClick={onFolderClick} />,
    };

    const tagsColumns: DashboardsTreeColumn = {
      id: 'tags',
      width: 2,
      Header: t('browse-dashboards.dashboards-tree.tags-column', 'Tags'),
      Cell: (props: DashboardsTreeCellProps) => <TagsCell {...props} onTagClick={onTagClick} />,
    };
    const canSelect = canSelectItems(permissions);
    const columns = [canSelect && checkboxColumn, nameColumn, tagsColumns].filter(isTruthy);

    return columns;
  }, [onFolderClick, onTagClick, permissions]);

  const table = useTable({ columns: tableColumns, data: items }, useCustomFlexLayout);
  const { getTableProps, getTableBodyProps, headerGroups } = table;

  const handleIsItemLoaded = useCallback(
    (itemIndex: number) => {
      return isItemLoaded(itemIndex);
    },
    [isItemLoaded]
  );

  const handleLoadMore = useCallback(
    async (startIndex: number, endIndex: number) => {
      const { parentUID } = items[startIndex];
      requestLoadMore(parentUID);
    },
    [requestLoadMore, items]
  );

  const onRowsRendered = useInfiniteLoader({
    rowCount: items.length,
    isRowLoaded: handleIsItemLoaded,
    loadMoreRows: handleLoadMore,
  });

  return (
    <div {...getTableProps()} role="table">
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
                  {column.render('Header', { isSelected, onAllSelectionChange, permissions })}
                </div>
              );
            })}
          </div>
        );
      })}

      <div {...getTableBodyProps()} data-testid={selectors.pages.BrowseDashboards.table.body}>
        <List
          rowComponent={VirtualListRow}
          rowCount={items.length}
          rowHeight={getRowHeight}
          rowProps={{
            table,
            isSelected,
            onAllSelectionChange,
            onItemSelectionChange,
            treeID,
            permissions,
            items,
          }}
          onRowsRendered={onRowsRendered}
          style={{
            height: height - HEADER_HEIGHT,
            width,
          }}
        />
      </div>
    </div>
  );
}

interface VirtualListRowProps {
  items: DashboardsTreeItem[];
  table: TableInstance<DashboardsTreeItem>;
  isSelected: DashboardsTreeCellProps['isSelected'];
  onAllSelectionChange: DashboardsTreeCellProps['onAllSelectionChange'];
  onItemSelectionChange: DashboardsTreeCellProps['onItemSelectionChange'];
  treeID: string;
  permissions: BrowseDashboardsPermissions;
}

function VirtualListRow({
  index,
  style,
  table,
  isSelected,
  onItemSelectionChange,
  treeID,
  permissions,
}: RowComponentProps<VirtualListRowProps>) {
  const styles = useStyles2(getStyles);
  const { rows, prepareRow } = table;

  const row = rows[index];
  prepareRow(row);

  const dashboardItem = row.original.item;
  const { key, ...rowProps } = row.getRowProps({ style });

  if (dashboardItem.kind === 'ui' && dashboardItem.uiKind === 'divider') {
    return (
      <div key={key} {...rowProps}>
        <hr className={styles.divider} />
      </div>
    );
  }

  return (
    <div
      key={key}
      {...rowProps}
      className={cx(styles.row, styles.bodyRow)}
      aria-labelledby={makeRowID(treeID, dashboardItem)}
      data-testid={selectors.pages.BrowseDashboards.table.row(
        'title' in dashboardItem ? dashboardItem.title : dashboardItem.uid
      )}
    >
      {row.cells.map((cell) => {
        const { key, ...cellProps } = cell.getCellProps();

        return (
          <div key={key} {...cellProps} className={styles.cell}>
            {cell.render('Cell', { isSelected, onItemSelectionChange, treeID, permissions })}
          </div>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    // Column flex properties (cell sizing) are set by customFlexTableLayout.ts

    row: css({
      gap: theme.spacing(1),
    }),

    divider: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      width: '100%',
      margin: 0,
    }),

    headerRow: css({
      backgroundColor: theme.colors.background.secondary,
      height: HEADER_HEIGHT,
    }),

    bodyRow: css({
      height: ROW_HEIGHT,

      '&:hover': {
        backgroundColor: theme.colors.action.hover,
      },
    }),

    cell: css({
      padding: theme.spacing(1),
      overflow: 'hidden', // Required so flex children can do text-overflow: ellipsis
      display: 'flex',
      alignItems: 'center',
    }),

    link: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
