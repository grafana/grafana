import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';
import { Text } from '@grafana/ui/src/components/Text/Text';
import { Trans } from 'app/core/internationalization';
import { Indent } from 'app/features/browse-dashboards/components/Indent';
import { DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { DashboardViewItem } from 'app/features/search/types';

import { FolderUID } from './types';

const ROW_HEIGHT = 40;
const CHEVRON_SIZE = 'md';

interface NestedFolderListProps {
  items: DashboardsTreeItem[];
  focusedItemIndex: number;
  foldersAreOpenable: boolean;
  selectedFolder: FolderUID | undefined;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
  onSelectionChange: (event: React.FormEvent<HTMLInputElement>, item: DashboardViewItem) => void;
}

export function NestedFolderList({
  items,
  focusedItemIndex,
  foldersAreOpenable,
  selectedFolder,
  onFolderClick,
  onSelectionChange,
}: NestedFolderListProps) {
  const styles = useStyles2(getStyles);

  const virtualData = useMemo(
    (): VirtualData => ({
      items,
      focusedItemIndex,
      foldersAreOpenable,
      selectedFolder,
      onFolderClick,
      onSelectionChange,
    }),
    [items, focusedItemIndex, foldersAreOpenable, selectedFolder, onFolderClick, onSelectionChange]
  );

  return (
    <div className={styles.table}>
      {items.length > 0 ? (
        <List
          height={ROW_HEIGHT * Math.min(6.5, items.length)}
          width="100%"
          itemData={virtualData}
          itemSize={ROW_HEIGHT}
          itemCount={items.length}
        >
          {Row}
        </List>
      ) : (
        <div className={styles.emptyMessage}>
          <Trans i18nKey="browse-dashboards.folder-picker.empty-message">No folders found</Trans>
        </div>
      )}
    </div>
  );
}

interface VirtualData extends NestedFolderListProps {}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: VirtualData;
}

function Row({ index, style: virtualStyles, data }: RowProps) {
  const { items, focusedItemIndex, foldersAreOpenable, selectedFolder, onFolderClick, onSelectionChange } = data;
  const { item, isOpen, level } = items[index];
  const rowRef = useRef<HTMLDivElement>(null);

  const id = useId() + `-uid-${item.uid}`;
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (index === focusedItemIndex) {
      rowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [focusedItemIndex, rowRef, index]);

  const handleClick = useCallback(
    (ev: React.MouseEvent<HTMLButtonElement>) => {
      ev.preventDefault();
      ev.stopPropagation();
      onFolderClick(item.uid, !isOpen);
    },
    [item.uid, isOpen, onFolderClick]
  );

  const handleRadioChange = useCallback(
    (ev: React.MouseEvent<HTMLDivElement>) => {
      if (item.kind === 'folder') {
        onSelectionChange(ev, item);
      }
    },
    [item, onSelectionChange]
  );

  if (item.kind !== 'folder') {
    return process.env.NODE_ENV !== 'production' ? (
      <span style={virtualStyles} className={styles.row}>
        Non-folder item {item.uid}
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
      role="treeitem"
      aria-selected={item.uid === selectedFolder}
      tabIndex={-1}
      onClick={handleRadioChange}
    >
      <div className={styles.rowBody}>
        <Indent level={level} />
        {foldersAreOpenable ? (
          <IconButton
            size={CHEVRON_SIZE}
            onMouseDown={handleClick}
            // tabIndex not needed here because we handle keyboard navigation at the input level
            tabIndex={-1}
            aria-label={isOpen ? `Collapse folder ${item.title}` : `Expand folder ${item.title}`}
            name={isOpen ? 'angle-down' : 'angle-right'}
          />
        ) : (
          <span className={styles.folderButtonSpacer} />
        )}

        <label className={styles.label}>
          <Text as="span" truncate>
            {item.title}
          </Text>
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

    // Should be the same size as the <IconButton /> for proper alignment
    folderButtonSpacer: css({
      paddingLeft: `calc(${getSvgSize(CHEVRON_SIZE)}px + ${theme.spacing(0.5)})`,
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
