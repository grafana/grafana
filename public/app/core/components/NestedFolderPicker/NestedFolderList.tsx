import { css } from '@emotion/css';
import React, { useCallback, useId, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';
import { Indent } from 'app/features/browse-dashboards/components/Indent';
import { DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { DashboardViewItem } from 'app/features/search/types';

import { FolderUID } from './types';

const ROW_HEIGHT = 40;
const LIST_HEIGHT = ROW_HEIGHT * 6.5; // show 6 and a bit rows

interface NestedFolderListProps {
  items: DashboardsTreeItem[];
  selectedFolder: FolderUID | undefined;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
  onSelectionChange: (event: React.FormEvent<HTMLInputElement>, item: DashboardViewItem) => void;
}

export function NestedFolderList({ items, selectedFolder, onFolderClick, onSelectionChange }: NestedFolderListProps) {
  const styles = useStyles2(getStyles);

  const virtualData = useMemo(
    (): VirtualData => ({ items, selectedFolder, onFolderClick, onSelectionChange }),
    [items, selectedFolder, onFolderClick, onSelectionChange]
  );

  return (
    <>
      <p className={styles.headerRow}>Name</p>
      <List height={LIST_HEIGHT} width="100%" itemData={virtualData} itemSize={ROW_HEIGHT} itemCount={items.length}>
        {Row}
      </List>
    </>
  );
}

interface VirtualData extends NestedFolderListProps {}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: VirtualData;
}

function Row({ index, style: virtualStyles, data }: RowProps) {
  const { items, selectedFolder, onFolderClick, onSelectionChange } = data;
  const { item, isOpen, level } = items[index];

  const id = useId() + `-uid-${item.uid}`;
  const styles = useStyles2(getStyles);

  const handleClick = useCallback(
    (ev: React.MouseEvent<HTMLButtonElement>) => {
      ev.preventDefault();
      onFolderClick(item.uid, !isOpen);
    },
    [item.uid, isOpen, onFolderClick]
  );

  const handleRadioChange = useCallback(
    (ev: React.FormEvent<HTMLInputElement>) => {
      if (item.kind === 'folder') {
        onSelectionChange(ev, item);
      }
    },
    [item, onSelectionChange]
  );

  if (item.kind !== 'folder') {
    return process.env.NODE_ENV !== 'production' ? <span>Non-folder item</span> : null;
  }

  return (
    <div style={virtualStyles} className={styles.row}>
      <input
        className={styles.radio}
        type="radio"
        value={id}
        id={id}
        name="folder"
        checked={item.uid === selectedFolder}
        onChange={handleRadioChange}
      />

      <div className={styles.rowBody}>
        <Indent level={level} />

        <IconButton
          onClick={handleClick}
          aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
          name={isOpen ? 'angle-down' : 'angle-right'}
        />

        <label className={styles.label} htmlFor={id}>
          <span>{item.title}</span>
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
    paddingLeft: theme.spacing(1),
  });

  return {
    headerRow: css({
      backgroundColor: theme.colors.background.secondary,
      height: ROW_HEIGHT,
      lineHeight: ROW_HEIGHT + 'px',
      margin: 0,
      paddingLeft: theme.spacing(3),
    }),

    row: css({
      display: 'flex',
      position: 'relative',
      alignItems: 'center',
      borderBottom: `solid 1px ${theme.colors.border.weak}`,
    }),

    radio: css({
      position: 'absolute',
      left: '-1000rem',

      '&:checked': {
        border: '1px solid green',
      },

      [`&:checked + .${rowBody}`]: {
        backgroundColor: theme.colors.background.secondary,

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
      },
    }),

    rowBody,

    label: css({
      '&:hover': {
        textDecoration: 'underline',
        cursor: 'pointer',
      },
    }),
  };
};
