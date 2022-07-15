import { css } from '@emotion/css';
import React from 'react';

import { NavModelItem, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  navItem: NavModelItem;
}

export function PageHeader({ navItem }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <>
      <h1 className={styles.pageTitle}>
        {navItem.img && <img className={styles.pageImg} src={navItem.img} alt={`logo for ${navItem.text}`} />}
        {navItem.text}
      </h1>
      {navItem.subTitle && <div className={styles.pageSubTitle}>{navItem.subTitle}</div>}
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
