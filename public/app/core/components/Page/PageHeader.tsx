import { css } from '@emotion/css';
import React from 'react';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { PageInfo } from '../PageInfo/PageInfo';

import { PageInfoItem } from './types';

export interface Props {
  navItem: NavModelItem;
  renderTitle?: (title: string) => React.ReactNode;
  actions?: React.ReactNode;
  info?: PageInfoItem[];
  subTitle?: React.ReactNode;
}

export function PageHeader({ navItem, renderTitle, actions, info, subTitle }: Props) {
  const styles = useStyles2(getStyles);
  const sub = subTitle ?? navItem.subTitle;

  const titleElement = renderTitle ? renderTitle(navItem.text) : <h1 className={styles.pageTitle}>{navItem.text}</h1>;

  return (
    <div className={styles.pageHeader}>
      <div className={styles.topRow}>
        <div className={styles.titleInfoContainer}>
          <div className={styles.title}>
            {navItem.img && <img className={styles.img} src={navItem.img} alt={`logo for ${navItem.text}`} />}
            {titleElement}
          </div>
          {info && <PageInfo info={info} />}
        </div>
        <div className={styles.actions}>{actions}</div>
      </div>
      {sub && <div className={styles.subTitle}>{sub}</div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    topRow: css({
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing(1, 2),
    }),
    title: css({
      display: 'flex',
      flexDirection: 'row',
    }),
    actions: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
    }),
    titleInfoContainer: css({
      display: 'flex',
      label: 'title-info-container',
      flex: 1,
      flexWrap: 'wrap',
      gap: theme.spacing(1, 4),
      justifyContent: 'space-between',
      maxWidth: '100%',
    }),
    pageHeader: css({
      label: 'page-header',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2),
    }),
    pageTitle: css({
      display: 'flex',
      marginBottom: 0,
    }),
    subTitle: css({
      position: 'relative',
      color: theme.colors.text.secondary,
    }),
    img: css({
      width: '32px',
      height: '32px',
      marginRight: theme.spacing(2),
    }),
  };
};
