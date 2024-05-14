import { css, cx } from '@emotion/css';
import React from 'react';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { Divider, useStyles2 } from '@grafana/ui';

import { PageInfo } from '../PageInfo/PageInfo';

import { EditableTitle } from './EditableTitle';
import { PageInfoItem } from './types';

export interface Props {
  navItem: NavModelItem;
  renderTitle?: (title: string) => React.ReactNode;
  actions?: React.ReactNode;
  info?: PageInfoItem[];
  subTitle?: React.ReactNode;
  onEditTitle?: (newValue: string) => Promise<void>;
  stickyHeader?: boolean;
}

export function PageHeader({ navItem, renderTitle, actions, info, subTitle, onEditTitle, stickyHeader }: Props) {
  const styles = useStyles2(getStyles);
  const sub = subTitle ?? navItem.subTitle;

  const titleElement = onEditTitle ? (
    <EditableTitle value={navItem.text} onEdit={onEditTitle} />
  ) : (
    <div className={styles.title}>
      {navItem.img && <img className={styles.img} src={navItem.img} alt={`logo for ${navItem.text}`} />}
      {renderTitle ? renderTitle(navItem.text) : <h1>{navItem.text}</h1>}
    </div>
  );

  return (
    <div className={cx(styles.pageHeader, { [styles.sticky]: stickyHeader })}>
      <div className={styles.topRow}>
        <div className={styles.titleInfoContainer}>
          {titleElement}
          {info && <PageInfo info={info} />}
        </div>
        <div className={styles.actions}>{actions}</div>
      </div>
      {sub && <div className={styles.subTitle}>{sub}</div>}
      {stickyHeader && <Divider />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    sticky: css({
      [theme.breakpoints.up('sm')]: {
        position: 'sticky',
        top: 0,
        zIndex: theme.zIndex.navbarFixed,
        backgroundColor: theme.colors.background.primary,
        paddingTop: theme.spacing(2),
        paddingRight: theme.spacing(4),
        paddingLeft: theme.spacing(4),
        marginBottom: theme.spacing(1),

        // Add a negative margin to the sides of the header
        // so that it can overlap any content that may be breaking out
        // of the page container
        marginRight: theme.spacing(-4),
        marginLeft: theme.spacing(-4),
      },
    }),
    topRow: css({
      alignItems: 'flex-start',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing(1, 3),
    }),
    title: css({
      display: 'flex',
      flexDirection: 'row',
      maxWidth: '100%',
      h1: {
        display: 'flex',
        marginBottom: 0,
      },
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
      minWidth: '200px',
    }),
    pageHeader: css({
      label: 'page-header',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(2),
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
