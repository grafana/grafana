import { css } from '@emotion/css';
import * as React from 'react';

import { type NavModelItem, type GrafanaTheme2 } from '@grafana/data';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Icon, useStyles2 } from '@grafana/ui';

import { PageInfo } from '../PageInfo/PageInfo';

import { EditableTitle } from './EditableTitle';
import { type PageInfoItem } from './types';

export interface Props {
  navItem: NavModelItem;
  renderTitle?: (title: string) => React.ReactNode;
  actions?: React.ReactNode;
  info?: PageInfoItem[];
  subTitle?: React.ReactNode;
  onEditTitle?: (newValue: string) => Promise<void>;
}

export function PageHeader({ navItem, renderTitle, actions, info, subTitle, onEditTitle }: Props) {
  const styles = useStyles2(getStyles);
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const sub = subTitle ?? navItem.subTitle;

  return (
    <div className={styles.pageHeader}>
      <div className={styles.topRow}>
        <div className={styles.titleInfoContainer}>
          <div className={styles.title}>
            {navItem.img && <img className={styles.img} src={navItem.img} alt={`logo for ${navItem.text}`} />}
<<<<<<< HEAD
            {navItem.icon && visualRefreshEnabled && (
              <div className={styles.icon}>
                <Icon name={navItem.icon} title={navItem.text} size="lg" />
              </div>
            )}
||||||| 9142d53b8b1
=======
            {navItem.icon && visualRefreshEnabled && (
              <div className={styles.icon}>
                <Icon name={navItem.icon} size="lg" />
              </div>
            )}
>>>>>>> 924fabb7136384e160cb2e532fca7f3d6b8404ab
            {onEditTitle ? (
              <EditableTitle value={navItem.text} onEdit={onEditTitle} />
            ) : renderTitle ? (
              renderTitle(navItem.text)
            ) : (
              <h1>{navItem.text}</h1>
            )}
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
      flex: 1,
      alignItems: 'center',
      h1: {
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
<<<<<<< HEAD
    icon: css({
      marginRight: theme.spacing(1.5),
      color: theme.colors.accent.text,
      backgroundColor: theme.colors.accent.transparent,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      width: theme.spacing(5),
      height: theme.spacing(5),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
||||||| 9142d53b8b1
=======
    icon: css({
      marginRight: theme.spacing(1.5),
      color: theme.colors.accent.text,
      backgroundColor: theme.colors.accent.transparent,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
      width: theme.spacing(4.5),
      height: theme.spacing(4.5),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
>>>>>>> 924fabb7136384e160cb2e532fca7f3d6b8404ab
  };
};
