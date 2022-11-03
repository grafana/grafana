import { css } from '@emotion/css';
import React from 'react';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getNavSubTitle, getNavTitle } from '../NavBar/navBarItem-translations';

export interface Props {
  navItem: NavModelItem;
  renderTitle?: (title: string) => React.ReactNode;
  actions?: React.ReactNode;
  subTitle?: React.ReactNode;
}

export function PageHeader({ navItem, renderTitle, actions, subTitle }: Props) {
  const styles = useStyles2(getStyles);
  const sub = subTitle ?? getNavSubTitle(navItem.id) ?? navItem.subTitle;

  const title = getNavTitle(navItem.id) ?? navItem.text;
  const titleElement = renderTitle ? renderTitle(title) : <h1 className={styles.pageTitle}>{title}</h1>;

  return (
    <div className={styles.pageHeader}>
      {navItem.img && <img className={styles.pageImg} src={navItem.img} alt={`logo for ${navItem.text}`} />}
      <div className={styles.titleWrapper}>
        {titleElement}
        {sub && <div className={styles.pageSubTitle}>{sub}</div>}
        {navItem.headerExtra && <navItem.headerExtra />}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    pageHeader: css({
      label: 'page-header',
      display: 'flex',
    }),
    titleWrapper: css({
      label: 'title-wrapper',
      display: 'flex',
      flexDirection: 'column',
    }),
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
