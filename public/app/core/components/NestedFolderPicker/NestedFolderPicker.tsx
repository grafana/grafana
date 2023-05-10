import { css } from '@emotion/css';
import React, { useState } from 'react';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, FilterInput, IconButton, useStyles2 } from '@grafana/ui';

const LIST_HEIGHT = 200;
const ROW_HEIGHT = 40;

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: Array<{
    name: string;
    level: number;
    expanded: boolean;
  }>;
}

function Row({ index, style, data }: RowProps) {
  const folder = data[index];
  const styles = useStyles2((theme) => getRowStyles(theme, folder.level));

  return (
    <div style={style} className={styles}>
      <IconButton name={folder.expanded ? 'angle-down' : 'angle-right'} />
      {folder.name}
    </div>
  );
}

export function NestedFolderPicker() {
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');

  return (
    <div>
      <h4>Select folder</h4>
      <FilterInput placeholder="Search folder" value={search} escapeRegex={false} onChange={(val) => setSearch(val)} />
      <p className={styles.headerRow}>Name</p>
      <List height={LIST_HEIGHT} width="100%" itemData={DATA} itemSize={ROW_HEIGHT} itemCount={DATA.length}>
        {Row}
      </List>
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
  css({
    display: 'flex',
    alignItems: 'center',
    borderBottom: `solid 2px ${theme.colors.border}`,
    paddingLeft: theme.spacing(level * 2),
    ':hover': {
      backgroundColor: theme.colors.background.secondary,
      cursor: 'pointer',
    },
  });

const DATA = [
  {
    name: 'Funky folder',
    level: 1,
    expanded: true,
  },
  {
    name: 'Funky folder 2',
    level: 1,
    expanded: true,
  },
  {
    name: 'Wasd folder',
    level: 1,
    expanded: true,
  },
  {
    name: 'Asdf folder',
    level: 2,
    expanded: false,
  },
  {
    name: 'Wasd folder 2',
    level: 2,
    expanded: false,
  },
  {
    name: 'Funky folder 2',
    level: 1,
    expanded: false,
  },
  {
    name: 'Funky folder',
    level: 1,
    expanded: false,
  },
  {
    name: 'Funky folder 2',
    level: 1,
    expanded: false,
  },
  {
    name: 'Wasd folder',
    level: 1,
    expanded: false,
  },
  {
    name: 'Asdf folder',
    level: 2,
    expanded: false,
  },
  {
    name: 'Wasd folder 2',
    level: 2,
    expanded: false,
  },
  {
    name: 'Funky folder 2',
    level: 1,
    expanded: false,
  },
];
