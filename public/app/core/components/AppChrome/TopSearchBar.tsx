import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Icon, ToolbarButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useSelector } from 'app/types';

import { NewsContainer } from './News/NewsContainer';
import { OrganizationSwitcher } from './Organization/OrganizationSwitcher';
import { SignInLink } from './TopBar/SignInLink';
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
        <OrganizationSwitcher />
      </div>
      <div className={styles.searchWrapper}>
        <TopSearchBarInput />
      </div>
      <div className={styles.actions}>
        {helpNode && (
          <Dropdown overlay={() => <TopNavBarMenu node={helpNode} />}>
            <ToolbarButton iconOnly icon="question-circle" aria-label="Help" />
          </Dropdown>
        )}
        <NewsContainer />
        {!contextSrv.user.isSignedIn && <SignInLink />}
        {profileNode && (
          <Dropdown overlay={<TopNavBarMenu node={profileNode} />}>
            <ToolbarButton
              className={styles.profileButton}
              imgSrc={contextSrv.user.gravatarUrl}
              imgAlt="User avatar"
              aria-label="Profile"
            />
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
      gap: theme.spacing(0.5),
      gridTemplateColumns: '1fr 2fr 1fr',
      padding: theme.spacing(0, 2),
      alignItems: 'center',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    leftContent: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    logo: css({
      display: 'flex',
    }),
    searchWrapper: css({}),
    searchInput: css({}),
    actions: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      justifyContent: 'flex-end',
      alignItems: 'center',
    }),
    profileButton: css({
      img: {
        borderRadius: '50%',
        height: '24px',
        marginRight: 0,
        width: '24px',
      },
    }),
  };
};
