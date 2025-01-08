import { css, cx } from '@emotion/css';
import { useCallback, useId, useMemo, useRef } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import { Text } from '@grafana/ui/src/components/Text/Text';
import { Indent } from 'app/core/components/Indent/Indent';
import { Trans } from 'app/core/internationalization';
import { childrenByParentUIDSelector, rootItemsSelector } from 'app/features/browse-dashboards/state';
import { DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { DashboardViewItem } from 'app/features/search/types';
import { useSelector } from 'app/types';

const ROW_HEIGHT = 40;
const CHEVRON_SIZE = 'md';

export const getDOMId = (idPrefix: string, id: string) => `${idPrefix}-${id || 'root'}`;

interface NestedFolderListProps {
  items: DashboardsTreeItem[];
  focusedItemIndex: number;
  foldersAreOpenable: boolean;
  idPrefix: string;
  selectedFolder: string | undefined;
  onFolderExpand: (uid: string, newOpenState: boolean) => void;
  onFolderSelect: (item: DashboardViewItem) => void;
  isItemLoaded: (itemIndex: number) => boolean;
  requestLoadMore: (folderUid: string | undefined) => void;
}

export function NestedFolderList({
  items,
  focusedItemIndex,
  foldersAreOpenable,
  idPrefix,
  selectedFolder,
  onFolderExpand,
  onFolderSelect,
  isItemLoaded,
  requestLoadMore,
}: NestedFolderListProps) {
  const infiniteLoaderRef = useRef<InfiniteLoader>(null);
  const styles = useStyles2(getStyles);

  const virtualData = useMemo(
    (): VirtualData => ({
      items,
      focusedItemIndex,
      foldersAreOpenable,
      selectedFolder,
      onFolderExpand,
      onFolderSelect,
      idPrefix,
    }),
    [items, focusedItemIndex, foldersAreOpenable, selectedFolder, onFolderExpand, onFolderSelect, idPrefix]
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

  return (
    <div className={styles.table} role="tree">
      {items.length > 0 ? (
        <InfiniteLoader
          ref={infiniteLoaderRef}
          itemCount={items.length}
          isItemLoaded={handleIsItemLoaded}
          loadMoreItems={handleLoadMore}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={ref}
              height={ROW_HEIGHT * Math.min(6.5, items.length)}
              width="100%"
              itemData={virtualData}
              itemSize={ROW_HEIGHT}
              itemCount={items.length}
              onItemsRendered={onItemsRendered}
            >
              {Row}
            </List>
          )}
        </InfiniteLoader>
      ) : (
        <div className={styles.emptyMessage}>
          <Trans i18nKey="browse-dashboards.folder-picker.empty-message">No folders found</Trans>
        </div>
      )}
    </div>
  );
}

interface VirtualData extends Omit<NestedFolderListProps, 'isItemLoaded' | 'requestLoadMore'> {}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: VirtualData;
}

const SKELETON_WIDTHS = [100, 200, 130, 160, 150];

function Row({ index, style: virtualStyles, data }: RowProps) {
  const { items, focusedItemIndex, foldersAreOpenable, selectedFolder, onFolderExpand, onFolderSelect, idPrefix } =
    data;
  const { item, isOpen, level, parentUID } = items[index];
  const rowRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const rootCollection = useSelector(rootItemsSelector);
  const childrenCollections = useSelector(childrenByParentUIDSelector);
  const children = (item.uid ? childrenCollections[item.uid] : rootCollection)?.items ?? [];
  let siblings: DashboardViewItem[] = [];
  // only look for siblings if we're not at the root
  if (item.uid) {
    siblings = (parentUID ? childrenCollections[parentUID] : rootCollection)?.items ?? [];
  }

  const styles = useStyles2(getStyles);

  const handleExpand = useCallback(
    (ev: React.MouseEvent<HTMLButtonElement>) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (item.uid) {
        onFolderExpand(item.uid, !isOpen);
      }
    },
    [item.uid, isOpen, onFolderExpand]
  );

  const handleSelect = useCallback(() => {
    if (item.kind === 'folder') {
      onFolderSelect(item);
    }
  }, [item, onFolderSelect]);

  if (item.kind === 'ui' && item.uiKind === 'pagination-placeholder') {
    return (
      <span style={virtualStyles} className={styles.row}>
        <Indent level={level} spacing={2} />
        <Skeleton width={SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]} />
      </span>
    );
  }

  if (item.kind !== 'folder') {
    const itemKind = item.kind;
    const itemUID = item.uid;
    return process.env.NODE_ENV !== 'production' ? (
      <span style={virtualStyles} className={styles.row}>
        <Trans i18nKey="browse-dashboards.folder-picker.non-folder-item">
          Non-folder {{ itemKind }} {{ itemUID }}
        </Trans>
      </span>
    ) : null;
  }

  return (
    // don't need a key handler here, it's handled at the input level in NestedFolderPicker
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      ref={rowRef}
      style={virtualStyles}
      className={cx(styles.row, {
        [styles.rowFocused]: index === focusedItemIndex,
        [styles.rowSelected]: item.uid === selectedFolder,
      })}
      tabIndex={-1}
      onClick={handleSelect}
      aria-expanded={isOpen}
      aria-selected={item.uid === selectedFolder}
      aria-labelledby={labelId}
      aria-level={level + 1} // aria-level is 1-indexed
      role="treeitem"
      aria-owns={children.length > 0 ? children.map((child) => getDOMId(idPrefix, child.uid)).join(' ') : undefined}
      aria-setsize={children.length}
      aria-posinset={siblings.findIndex((i) => i.uid === item.uid) + 1}
      id={getDOMId(idPrefix, item.uid)}
    >
      <div className={styles.rowBody}>
        <Indent level={level} spacing={2} />

        {foldersAreOpenable ? (
          <IconButton
            size={CHEVRON_SIZE}
            // by using onMouseDown here instead of onClick we can stop focus moving
            // to the button when the user clicks it (via preventDefault + stopPropagation)
            onMouseDown={handleExpand}
            // tabIndex not needed here because we handle keyboard navigation at the input level
            tabIndex={-1}
            aria-label={isOpen ? `Collapse folder ${item.title}` : `Expand folder ${item.title}`}
            name={isOpen ? 'angle-down' : 'angle-right'}
          />
        ) : (
          <span className={styles.folderButtonSpacer} />
        )}

        <label className={styles.label} id={labelId}>
          <Text truncate>{item.title}</Text>
        </label>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const rowBody = css({
    height: ROW_HEIGHT,
    display: 'flex',
    position: 'relative',
    alignItems: 'center',
    flexGrow: 1,
    gap: theme.spacing(0.5),
    overflow: 'hidden',
    padding: theme.spacing(0, 1),
  });

  return {
    table: css({
      background: theme.components.input.background,
    }),

    emptyMessage: css({
      padding: theme.spacing(1),
      textAlign: 'center',
      width: '100%',
    }),

    folderButtonSpacer: css({
      paddingLeft: theme.spacing(0.5),
    }),

    row: css({
      display: 'flex',
      position: 'relative',
      alignItems: 'center',
      [':not(:first-child)']: {
        borderTop: `solid 1px ${theme.colors.border.weak}`,
      },
    }),

    rowFocused: css({
      backgroundColor: theme.colors.background.secondary,
    }),

    rowSelected: css({
      '&::before': {
        display: 'block',
        content: '""',
        position: 'absolute',
        left: 0,
        bottom: 0,
        top: 0,
        width: 4,
        borderRadius: theme.shape.radius.default,
        backgroundImage: theme.colors.gradients.brandVertical,
      },
    }),

    rowBody,

    label: css({
      lineHeight: ROW_HEIGHT + 'px',
      flexGrow: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      '&:hover': {
        textDecoration: 'underline',
        cursor: 'pointer',
      },
    }),
  };
};
