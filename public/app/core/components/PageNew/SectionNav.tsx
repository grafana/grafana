import { css } from '@emotion/css';
import React from 'react';

import { NavModel, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, CustomScrollbar } from '@grafana/ui';

import { SectionNavItem } from './SectionNavItem';

export interface Props {
  model: NavModel;
}

export function SectionNav({ model }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <nav className={styles.nav}>
      <CustomScrollbar showScrollIndicators>
        <div className={styles.items} role="tablist">
          <SectionNavItem item={model.main} />
        </div>
      </CustomScrollbar>
    </nav>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    nav: css({
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.background.canvas,
      flexShrink: 0,
      [theme.breakpoints.up('md')]: {
        width: '250px',
      },
    }),
    items: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(4.5, 1, 2, 2),
    }),
  };
};
