import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Icon, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useSelector } from 'app/types';

import { NewsContainer } from './News/NewsContainer';
import { TopNavBarMenu } from './TopBar/TopNavBarMenu';
import { TopSearchBarInput } from './TopSearchBarInput';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export function TopSearchBar() {
  const styles = useStyles2(getStyles);
  const navIndex = useSelector((state) => state.navIndex);

  const helpNode = navIndex['help'];
  const profileNode = navIndex['profile'];

  return (
    <div className={styles.container}>
      <div className={styles.leftContent}>
        <a className={styles.logo} href="/" title="Go to home">
          <Icon name="grafana" size="xl" />
        </a>
      </div>
      <div className={styles.searchWrapper}>
        <TopSearchBarInput />
      </div>
      <div className={styles.actions}>
        {helpNode && (
          <Dropdown overlay={() => <TopNavBarMenu node={helpNode} />}>
            <button className={styles.actionItem}>
              <Icon name="question-circle" size="lg" />
            </button>
          </Dropdown>
        )}
        <NewsContainer buttonCss={styles.actionItem} />
        {!contextSrv.user.isSignedIn && (
          <a className={styles.signIn} href="login" target="_self">
            Sign in
          </a>
        )}
        {profileNode && (
          <Dropdown overlay={<TopNavBarMenu node={profileNode} />}>
            <button className={styles.actionItem}>
              <img src={contextSrv.user.gravatarUrl} alt="User avatar" />
            </button>
          </Dropdown>
        )}
      </div>
    </div>
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
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    leftContent: css({
      display: 'flex',
    }),
    logo: css({
      display: 'flex',
    }),
    signIn: css({}),
    searchWrapper: css({}),
    searchInput: css({}),
    actions: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
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
