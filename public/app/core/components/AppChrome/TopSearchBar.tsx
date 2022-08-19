import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, FilterInput, Icon, Menu, MenuItem, Tooltip, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';

import { TOP_BAR_LEVEL_HEIGHT } from './types';

export function TopSearchBar() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.leftContent}>
        <a className={styles.logo} href="/" title="Go to home">
          <Icon name="grafana" size="xl" />
        </a>
      </div>
      <div className={styles.searchWrapper}>
        <FilterInput placeholder="Search grafana" value={''} onChange={() => {}} className={styles.searchInput} />
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
          <Dropdown overlay={ProfileMenu}>
            <button className={styles.actionItem}>
              <img src={contextSrv.user.gravatarUrl} />
            </button>
          </Dropdown>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * This is just temporary, needs syncing with the backend option like DisableSignoutMenu
 */
export function ProfileMenu() {
  return (
    <Menu>
      <MenuItem url="profile" label="Your profile" />
      <MenuItem url="profile/notifications" label="Your notifications" />
      <MenuItem url="logout" label="Sign out" />
    </Menu>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      height: TOP_BAR_LEVEL_HEIGHT,
      display: 'grid',
      gridTemplateColumns: '1fr 2fr 1fr',
      padding: theme.spacing(0, 2),
      alignItems: 'center',
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    leftContent: css({
      display: 'flex',
    }),
    logo: css({
      display: 'flex',
    }),
    searchWrapper: css({}),
    searchInput: css({}),
    actions: css({
      display: 'flex',
      gap: theme.spacing(1),
      justifyContent: 'flex-end',
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
