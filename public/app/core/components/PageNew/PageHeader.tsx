import { css } from '@emotion/css';
import React from 'react';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getNavSubTitle, getNavTitle } from '../NavBar/navBarItem-translations';

export interface Props {
  navItem: NavModelItem;
  subTitle?: React.ReactNode;
}

export function PageHeader({ navItem, subTitle }: Props) {
  const styles = useStyles2(getStyles);
  const sub = subTitle ?? getNavSubTitle(navItem.id) ?? navItem.subTitle;

  return (
    <>
      <h1 className={styles.pageTitle}>
        {navItem.img && <img className={styles.pageImg} src={navItem.img} alt={`logo for ${navItem.text}`} />}
        {getNavTitle(navItem.id) ?? navItem.text}
      </h1>
      {sub && <div className={styles.pageSubTitle}>{sub}</div>}
      {navItem.headerExtra && <navItem.headerExtra />}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    pageTitle: css({
      display: 'flex',
      marginBottom: theme.spacing(3),
    }),
    pageSubTitle: css({
      marginBottom: theme.spacing(2),
      position: 'relative',
      top: theme.spacing(-1),
      color: theme.colors.text.secondary,
    }),
    pageImg: css({
      width: '32px',
      height: '32px',
      marginRight: theme.spacing(2),
    }),
  };
};
