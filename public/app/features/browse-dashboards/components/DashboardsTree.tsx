import { css, cx } from '@emotion/css';
import { flexRender, getCoreRowModel, type Table, useReactTable } from '@tanstack/react-table';
import * as React from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { VariableSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { type GrafanaTheme2, isTruthy } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { FolderReadmePanel } from 'app/features/provisioning/components/Folders/FolderReadmePanel';
import { type DashboardViewItem } from 'app/features/search/types';

import { canSelectItems } from '../permissions';
import {
  type BrowseDashboardsPermissions,
  type DashboardsTreeCellProps,
  type DashboardsTreeColumn,
  type DashboardsTreeItem,
  type SelectionState,
} from '../types';
import { makeRowID } from '../utils/dashboards';

import CheckboxCell from './CheckboxCell';
import CheckboxHeaderCell from './CheckboxHeaderCell';
import { NameCell } from './NameCell';
import { TagsCell } from './TagsCell';
import { getColumnFlexStyle, getFlexRowStyle } from './customFlexTableLayout';

interface DashboardsTreeProps {
  items: DashboardsTreeItem[];
  width: number;
  height: number;
  permissions: BrowseDashboardsPermissions;
  folderUID?: string;
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
// Initial estimate for the README row; replaced by the ResizeObserver-measured
// height once the row mounts. The row must cover the real content height:
// WebKit does not extend the scroller's scrollable area for content that
// overflows the absolutely-positioned row, so an undersized row makes Safari
// snap the scroll position back (content past the row is unreachable).
const README_ROW_HEIGHT = 320;
const README_ROW_PADDING_TOP = 16; // matches theme.spacing(2)

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
  folderUID,
}: DashboardsTreeProps) {
  const treeID = useId();

  const infiniteLoaderRef = useRef<InfiniteLoader>(null);
  const listRef = useRef<List | null>(null);
  const styles = useStyles2(getStyles);

  const [readmeHeight, setReadmeHeight] = useState(README_ROW_HEIGHT);

  const handleReadmeHeightChange = useCallback((height: number) => {
    // Ignore 0 (display:none / mid-unmount); React bails out on same-value sets.
    if (height > 0) {
      setReadmeHeight(Math.ceil(height));
    }
  }, []);
  useEffect(() => {
    // The tree stays mounted across folder navigation; a stale measurement would
    // otherwise persist when the next folder's README panel renders nothing.
    setReadmeHeight(README_ROW_HEIGHT);
  }, [folderUID]);

  useEffect(() => {
    // If the tree changed identity, then some indexes that were previously loaded may now be unloaded,
    // especially after a refetch after a move/delete.
    // Clear that cache, and check if we need to trigger another load
    if (infiniteLoaderRef.current) {
      infiniteLoaderRef.current.resetloadMoreItemsCache(true);
    }

    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [items]);

  useEffect(() => {
    // VariableSizeList caches row offsets; re-measure when the README grows/shrinks.
    listRef.current?.resetAfterIndex(0);
  }, [readmeHeight]);

  const tableColumns = useMemo(() => {
    const checkboxColumn: DashboardsTreeColumn = {
      id: 'checkbox',
      size: 0,
      header: (props) => (
        <CheckboxHeaderCell
          {...props}
          isSelected={isSelected}
          onAllSelectionChange={onAllSelectionChange}
          permissions={permissions}
        />
      ),
      cell: (props) => (
        <CheckboxCell
          {...props}
          isSelected={isSelected}
          onItemSelectionChange={onItemSelectionChange}
          permissions={permissions}
        />
      ),
    };

    const nameColumn: DashboardsTreeColumn = {
      id: 'name',
      size: 3,
      header: () => (
        <span style={{ paddingLeft: 24 }}>
          <Trans i18nKey="browse-dashboards.dashboards-tree.name-column">Name</Trans>
        </span>
      ),
      cell: (props) => <NameCell {...props} onFolderClick={onFolderClick} treeID={treeID} permissions={permissions} />,
    };

    const tagsColumns: DashboardsTreeColumn = {
      id: 'tags',
      size: 2,
      header: t('browse-dashboards.dashboards-tree.tags-column', 'Tags'),
      cell: (props) => <TagsCell {...props} onTagClick={onTagClick} />,
    };
    const canSelect = canSelectItems(permissions);
    const columns = [canSelect && checkboxColumn, nameColumn, tagsColumns].filter(isTruthy);

    return columns;
  }, [isSelected, onAllSelectionChange, onFolderClick, onItemSelectionChange, onTagClick, permissions, treeID]);

  const table = useReactTable({
    columns: tableColumns,
    data: items,
    getCoreRowModel: getCoreRowModel(),
    // the tree isn't paginated, so skip the state update TanStack Table queues whenever the data changes
    autoResetPageIndex: false,
  });
  const headerGroups = table.getHeaderGroups();

  const virtualData = useMemo(
    () => ({
      table,
      isSelected,
      onAllSelectionChange,
      onItemSelectionChange,
      treeID,
      permissions,
      folderUID,
      onReadmeHeightChange: handleReadmeHeightChange,
    }),
    // we need this to rerender if items changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      table,
      isSelected,
      onAllSelectionChange,
      onItemSelectionChange,
      items,
      treeID,
      permissions,
      folderUID,
      handleReadmeHeightChange,
    ]
  );

  const handleIsItemLoaded = useCallback(
    (itemIndex: number) => {
      return isItemLoaded(itemIndex);
    },
    [isItemLoaded]
  );

  const handleLoadMore = useCallback(
    (startIndex: number, endIndex: number) => {
      const { parentUID } = items[startIndex];
      requestLoadMore(parentUID);
    },
    [requestLoadMore, items]
  );

  const getRowHeight = useCallback(
    (rowIndex: number) => {
      const row = items[rowIndex];
      if (row.item.kind === 'ui' && row.item.uiKind === 'divider') {
        return DIVIDER_HEIGHT;
      }
      if (row.item.kind === 'ui' && row.item.uiKind === 'readme') {
        return readmeHeight + README_ROW_PADDING_TOP;
      }

      return ROW_HEIGHT;
    },
    [items, readmeHeight]
  );

  const itemKey = useCallback(
    (index: number) => {
      const item = items[index].item;
      // Stabilize the readme row's identity across position shifts so
      // react-window preserves the component instance when items are
      // inserted before it (e.g. folder expansion). Other rows keep the
      // default index-based keying.
      if (item.kind === 'ui' && item.uiKind === 'readme') {
        return item.uid;
      }
      return index;
    },
    [items]
  );

  return (
    <div role="table">
      {headerGroups.map((headerGroup) => {
        return (
          <div
            key={headerGroup.id}
            role="row"
            style={{ width, ...getFlexRowStyle() }}
            className={cx(styles.row, styles.headerRow)}
          >
            {headerGroup.headers.map((header) => {
              return (
                <div
                  key={header.id}
                  style={getColumnFlexStyle(header.column)}
                  role="columnheader"
                  className={styles.cell}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </div>
              );
            })}
          </div>
        );
      })}

      <div role="rowgroup" data-testid={selectors.pages.BrowseDashboards.table.body}>
        <InfiniteLoader
          ref={infiniteLoaderRef}
          itemCount={items.length}
          isItemLoaded={handleIsItemLoaded}
          loadMoreItems={handleLoadMore}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={(elem) => {
                ref(elem);
                listRef.current = elem;
              }}
              height={height - HEADER_HEIGHT}
              width={width}
              itemCount={items.length}
              itemData={virtualData}
              estimatedItemSize={ROW_HEIGHT}
              itemSize={getRowHeight}
              onItemsRendered={onItemsRendered}
              itemKey={itemKey}
            >
              {VirtualListRow}
            </List>
          )}
        </InfiniteLoader>
      </div>
    </div>
  );
}

interface VirtualListRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    table: Table<DashboardsTreeItem>;
    isSelected: DashboardsTreeCellProps['isSelected'];
    onAllSelectionChange: DashboardsTreeCellProps['onAllSelectionChange'];
    onItemSelectionChange: DashboardsTreeCellProps['onItemSelectionChange'];
    treeID: string;
    permissions: BrowseDashboardsPermissions;
    folderUID?: string;
    onReadmeHeightChange: (height: number) => void;
  };
}

function VirtualListRow({ index, style, data }: VirtualListRowProps) {
  const styles = useStyles2(getStyles);
  const { table, isSelected, onItemSelectionChange, treeID, permissions } = data;
  const rows = table.getRowModel().rows;

  const row = rows[index];

  const dashboardItem = row.original.item;
  const rowProps = { role: 'row', style: { ...style, ...getFlexRowStyle() } };

  if (dashboardItem.kind === 'ui' && dashboardItem.uiKind === 'divider') {
    return (
      <div key={row.id} {...rowProps} role="presentation">
        <hr className={styles.divider} aria-hidden />
      </div>
    );
  }

  if (dashboardItem.kind === 'ui' && dashboardItem.uiKind === 'readme' && data.folderUID) {
    return (
      <ReadmeRow
        key={row.id}
        rowProps={rowProps}
        folderUID={data.folderUID}
        onHeightChange={data.onReadmeHeightChange}
      />
    );
  }

  return (
    <div
      key={row.id}
      {...rowProps}
      className={cx(styles.row, styles.bodyRow)}
      aria-labelledby={makeRowID(treeID, dashboardItem)}
      data-testid={selectors.pages.BrowseDashboards.table.row(
        'title' in dashboardItem ? dashboardItem.title : dashboardItem.uid
      )}
    >
      {row.getVisibleCells().map((cell) => {
        return (
          <div key={cell.id} role="cell" style={getColumnFlexStyle(cell.column)} className={styles.cell}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        );
      })}
    </div>
  );
}

interface ReadmeRowProps {
  rowProps: React.HTMLAttributes<HTMLDivElement>;
  folderUID: string;
  onHeightChange: (height: number) => void;
}

function ReadmeRow({ rowProps, folderUID, onHeightChange }: ReadmeRowProps) {
  const styles = useStyles2(getStyles);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      onHeightChange(element.offsetHeight);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <div {...rowProps} className={styles.readmeRow}>
      <div ref={contentRef}>
        <FolderReadmePanel folderUID={folderUID} />
      </div>
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

    readmeRow: css({
      paddingTop: theme.spacing(2),
      flexDirection: 'column',
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
