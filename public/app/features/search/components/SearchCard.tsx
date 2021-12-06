import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { DashboardSectionItem } from '../types';

export interface Props {
  item: DashboardSectionItem;
  themeId: 'dark' | 'light';
}

export function SearchCard({ item, themeId }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <a className={styles.gridItem} key={item.uid} href={item.url}>
      <img className={styles.image} src={`/preview/dash/${item.uid}/square/${themeId}`} />
    </a>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  gridItem: css`
    height: 200px;
  `,
  image: css`
    height: 100%;
    width: 100%;
  `,
});
