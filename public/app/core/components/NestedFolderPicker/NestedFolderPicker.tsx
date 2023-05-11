import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, FilterInput, IconButton, LoadingBar, useStyles2 } from '@grafana/ui';

const LIST_HEIGHT = 200;
const ROW_HEIGHT = 40;

interface RootFolder {
  title: string;
  id?: number;
  uid: string;
}

type RootFolderWithUiState = RootFolder & {
  level: number;
  expanded: boolean;
};

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
        <IconButton name={folder.expanded ? 'angle-down' : 'angle-right'} />
        <span>{folder.title}</span>
      </label>
    </div>
  );
}

async function fetchRootFolders(): Promise<RootFolderWithUiState[]> {
  const root = await getBackendSrv().get<RootFolder[]>('/api/folders');
  const foldersWithLevel = root.map((rootFolder) => {
    return { title: rootFolder.title, uid: rootFolder.uid, level: 1, expanded: false };
  });

  return foldersWithLevel;
}

export function NestedFolderPicker() {
  const [search, setSearch] = useState('');
  const styles = useStyles2(getStyles);
  const state = useAsync(fetchRootFolders);

  return (
    <div>
      <h4>Select folder</h4>
      <FilterInput placeholder="Search folder" value={search} escapeRegex={false} onChange={(val) => setSearch(val)} />
      <p className={styles.headerRow}>Name</p>
      {state.loading && <LoadingBar width={300} />}
      {state.error && <p>{state.error.message}</p>}
      {state.value && (
        <fieldset>
          <List
            height={LIST_HEIGHT}
            width="100%"
            itemData={state.value}
            itemSize={ROW_HEIGHT}
            itemCount={state.value.length}
          >
            {Row}
          </List>
        </fieldset>
      )}
      <Button>Select</Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  headerRow: css({
    backgroundColor: theme.colors.background.secondary,
    height: ROW_HEIGHT,
    lineHeight: ROW_HEIGHT + 'px',
    margin: 0,
    marginTop: theme.spacing(2),
    paddingLeft: theme.spacing(3),
  }),
});

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
