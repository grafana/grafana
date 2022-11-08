import { css } from '@emotion/css';
import React from 'react';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getNavSubTitle, getNavTitle } from '../NavBar/navBarItem-translations';
import { PageInfoItem } from '../Page/types';
import { PageInfo } from '../PageInfo/PageInfo';

export interface Props {
  navItem: NavModelItem;
  renderTitle?: (title: string) => React.ReactNode;
  actions?: React.ReactNode;
  info?: PageInfoItem[];
  subTitle?: React.ReactNode;
}

export function PageHeader({ navItem, renderTitle, actions, info, subTitle }: Props) {
  const styles = useStyles2(getStyles);
  const sub = subTitle ?? getNavSubTitle(navItem.id) ?? navItem.subTitle;

  const title = getNavTitle(navItem.id) ?? navItem.text;
  const titleElement = renderTitle ? renderTitle(title) : <h1 className={styles.pageTitle}>{title}</h1>;

  return (
    <div className={styles.titleWrapper}>
      <div className={styles.row}>
        <div className={styles.pageHeader}>
          <div className={styles.title}>
            {navItem.img && <img className={styles.pageImg} src={navItem.img} alt={`logo for ${navItem.text}`} />}
            {titleElement}
          </div>
          {info && <PageInfo info={info} />}
        </div>
        <div className={styles.actions}>{actions}</div>
      </div>
      {sub && <div className={styles.pageSubTitle}>{sub}</div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    row: css({
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing(1, 2),
    }),
    title: css({
      display: 'flex',
      flexDireciton: 'row',
    }),
    actions: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
    }),
    pageHeader: css({
      display: 'flex',
      label: 'page-header',
      flex: 1,
      flexWrap: 'wrap',
      gap: theme.spacing(1, 4),
      justifyContent: 'space-between',
      maxWidth: '100%',
    }),
    titleWrapper: css({
      label: 'title-wrapper',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    pageTitle: css({
      display: 'flex',
      marginBottom: 0,
    }),
    pageSubTitle: css({
      marginBottom: theme.spacing(2),
      position: 'relative',
      color: theme.colors.text.secondary,
    }),
    pageImg: css({
      width: '32px',
      height: '32px',
      marginRight: theme.spacing(2),
    }),
  };
};
