import { css } from '@emotion/css';
import React from 'react';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2 } from '@grafana/ui';

import { RootFolderWithUiState } from './types';

const LIST_HEIGHT = 200;
const ROW_HEIGHT = 40;

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: RootFolderWithUiState[];
}

function Row({ index, style, data }: RowProps) {
  const folder = data[index];
  const styles = useStyles2((theme) => getRowStyles(theme, folder.level));

  return (
    <div style={style} className={styles}>
      <input type="radio" value={folder.uid} id={folder.uid} name="folder" />
      <label htmlFor={folder.uid}>
        <IconButton ariaLabel="Open folder" name={folder.expanded ? 'angle-down' : 'angle-right'} />
        <span>{folder.title}</span>
      </label>
    </div>
  );
}

interface NestedFolderListProps {
  data: RootFolderWithUiState[];
}

export function NestedFolderList({ data }: NestedFolderListProps) {
  const styles = useStyles2(getHeaderRowStyles);

  return (
    <>
      <p className={styles}>Name</p>
      <List height={LIST_HEIGHT} width="100%" itemData={data} itemSize={ROW_HEIGHT} itemCount={data.length}>
        {Row}
      </List>
    </>
  );
}

const getRowStyles = (theme: GrafanaTheme2, level: number) =>
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
      padding-left: ${theme.spacing(level * 2)};
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
