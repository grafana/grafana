import { css } from '@emotion/css';
import React, { useState } from 'react';
import { FixedSizeList as List } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, IconButton, useStyles2 } from '@grafana/ui';

const LIST_HEIGHT = 200;
const ROW_HEIGHT = 35;

interface RowProps {
  index: number;
  style: React.CSSProperties;
}

function Row({ index, style }: RowProps) {
  const styles = useStyles2(getStyles);

  return (
    <div style={style} className={styles.row}>
      <IconButton name="angle-right" />
      {index}
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
      <List height={LIST_HEIGHT} width="100%" itemSize={35} itemCount={ROW_HEIGHT}>
        {Row}
      </List>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    paddingLeft: theme.spacing(1),
  }),
  headerRow: css({
    backgroundColor: theme.colors.background.secondary,
    height: ROW_HEIGHT,
    lineHeight: ROW_HEIGHT + 'px',
    margin: 0,
    paddingLeft: theme.spacing(4),
  }),
});
