import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { SearchResultsProps } from './SearchResultsTable';

export const FolderView = ({
  width,
  height,
  selection,
  selectionToggle,
  onTagSelected,
  onDatasourceChange,
}: SearchResultsProps) => {
  const styles = useStyles2(getStyles);

  return <div className={styles.wrapper}>TODO... list root folders and each sub item</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  virtualizedGridItemWrapper: css`
    padding: 4px;
  `,
  wrapper: css`
    display: flex;
    flex-direction: column;

    > ul {
      list-style: none;
    }
  `,
});
