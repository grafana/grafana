import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';

import { TOP_BAR_LEVEL_HEIGHT } from './types';

export function TopSearchBar() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.searchBar}>
      <a className={styles.logo} href="/" title="Go to home">
        <Icon name="grafana" size="xl" />
      </a>
      <div className={styles.searchWrapper}>
        <FilterInput
          width={50}
          placeholder="Search grafana"
          value={''}
          onChange={() => {}}
          className={styles.searchInput}
        />
      </div>
      <div className={styles.actions}>
        <Tooltip placement="bottom" content="Help menu (todo)">
          <button className={styles.actionItem}>
            <Icon name="question-circle" size="lg" />
          </button>
        </Tooltip>
        <Tooltip placement="bottom" content="Grafana news (todo)">
          <button className={styles.actionItem}>
            <Icon name="rss" size="lg" />
          </button>
        </Tooltip>
        <Tooltip placement="bottom" content="User profile (todo)">
          <button className={styles.actionItem}>
            <img src={contextSrv.user.gravatarUrl} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    searchBar: css({
      height: TOP_BAR_LEVEL_HEIGHT,
      display: 'flex',
      padding: theme.spacing(0, 2),
      alignItems: 'center',
      justifyContent: 'space-between',
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    logo: css({
      display: 'flex',
    }),
    searchWrapper: css({}),
    searchInput: css({}),
    actions: css({
      display: 'flex',
      flexGrow: 0,
      gap: theme.spacing(1),
      position: 'relative',
      width: 25, // this and the left pos is to make search input perfectly centered
      left: -83,
    }),
    actionItem: css({
      display: 'flex',
      flexGrow: 0,
      border: 'none',
      boxShadow: 'none',
      background: 'none',
      alignItems: 'center',

      color: theme.colors.text.secondary,
      '&:hover': {
        background: theme.colors.background.secondary,
      },
      img: {
        borderRadius: '50%',
        width: '24px',
        height: '24px',
      },
    }),
  };
};
