import { css, cx } from '@emotion/css';
import React from 'react';

import { NavModel, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, CustomScrollbar } from '@grafana/ui';

import { SectionNavItem } from './SectionNavItem';

export interface Props {
  model: NavModel;
  isExpanded: boolean;
}

export function SectionNav({ model, isExpanded }: Props) {
  const styles = useStyles2(getStyles);

  if (!Boolean(model.main?.children?.length)) {
    return null;
  }

  return (
    <nav
      className={cx(styles.nav, {
        [styles.navExpanded]: isExpanded,
      })}
    >
      <CustomScrollbar showScrollIndicators>
        <div className={styles.items} role="tablist">
          <SectionNavItem item={model.main} isSectionRoot />
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
      transition: theme.transitions.create(['width', 'max-height']),
      [theme.breakpoints.up('md')]: {
        width: 0,
      },
      [theme.breakpoints.down('md')]: {
        maxHeight: 0,
      },
    }),
    navExpanded: css({
      [theme.breakpoints.up('md')]: {
        width: '250px',
      },
      [theme.breakpoints.down('md')]: {
        maxHeight: '50vh',
      },
    }),
    items: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(4.5, 1, 2, 2),
      minWidth: '250px',
    }),
  };
};
