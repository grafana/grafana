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
const LIST_HEIGHT = ROW_HEIGHT * 6.5;

interface NestedFolderListProps {
  items: DashboardsTreeItem[];
  selectedFolder: FolderUID | undefined;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
  onSelectionChange: (event: React.FormEvent<HTMLInputElement>, item: DashboardViewItem) => void;
}

export function NestedFolderList({ items, selectedFolder, onFolderClick, onSelectionChange }: NestedFolderListProps) {
  const styles = useStyles2(getHeaderRowStyles);

  const virtualData = useMemo(
    (): VirtualData => ({ items, selectedFolder, onFolderClick, onSelectionChange }),
    [items, selectedFolder, onFolderClick, onSelectionChange]
  );

  return (
    <>
      <p className={styles}>Name</p>
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

function Row({ index, style, data }: RowProps) {
  const { items, selectedFolder, onFolderClick, onSelectionChange } = data;
  const { item, isOpen, level } = items[index];

  const id = useId() + `-uid-${item.uid}`;
  const styles = useStyles2(getRowStyles);

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
    <div style={style} className={styles}>
      <Indent level={level} />
      <input
        type="radio"
        value={id}
        id={id}
        name="folder"
        checked={item.uid === selectedFolder}
        onChange={handleRadioChange}
      />

      <label htmlFor={id}>
        <IconButton
          onClick={handleClick}
          aria-label={isOpen ? 'Collapse folder' : 'Expand folder'}
          name={isOpen ? 'angle-down' : 'angle-right'}
        />
        <span>{item.title}</span>
      </label>
    </div>
  );
}

const getRowStyles = (theme: GrafanaTheme2) =>
  css(`
    display: flex;
    position: relative;
    align-items: center;
    border-bottom: solid 1px ${theme.colors.border.weak};

    & label {
      flex-grow: 1;
      display: flex;
      height: 100%;
      align-items: center;
      cursor: pointer;
      padding-left: ${theme.spacing(2)}
    }

    &:hover,
    &:focus,
    & input:checked + label {
      background-color: ${theme.colors.background.secondary};
    }

    & input {
      position: absolute;
      left: -1000rem;
    }

    & input:checked + label::before {
      display: block;
      content: ' ';
      position: absolute;
      left: 0;
      bottom: 0;
      top: 0;
      width: 4px;
      border-radius: ${theme.shape.radius.default};
      background-image: ${theme.colors.gradients.brandVertical};
    }
  `);

const getHeaderRowStyles = (theme: GrafanaTheme2) =>
  css({
    backgroundColor: theme.colors.background.secondary,
    height: ROW_HEIGHT,
    lineHeight: ROW_HEIGHT + 'px',
    margin: 0,
    marginTop: theme.spacing(2),
    paddingLeft: theme.spacing(3),
  });
