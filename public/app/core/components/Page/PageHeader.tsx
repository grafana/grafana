import { css } from '@emotion/css';
import * as React from 'react';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { EditableTitle } from './EditableTitle';

export interface Props {
  navItem: NavModelItem;
  renderTitle?: (title: string) => React.ReactNode;
  actions?: React.ReactNode;
  subTitle?: React.ReactNode;
  onEditTitle?: (newValue: string) => Promise<void>;
}

export function PageHeader({ navItem, renderTitle, actions, subTitle, onEditTitle }: Props) {
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
    <div className={styles.pageHeader}>
      <div className={styles.topRow}>
        <div className={styles.titleInfoContainer}>{titleElement}</div>
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
    title: css({ display: 'flex', flexDirection: 'row', maxWidth: '100%', flex: 1, h1: { marginBottom: 0 } }),
    actions: css({ display: 'flex', flexDirection: 'row', gap: theme.spacing(1) }),
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
    subTitle: css({ position: 'relative', color: theme.colors.text.secondary }),
    img: css({ width: '32px', height: '32px', marginRight: theme.spacing(2) }),
  };
};
