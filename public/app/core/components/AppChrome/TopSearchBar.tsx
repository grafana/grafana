import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Icon, ToolbarButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useSelector } from 'app/types';

import { NewsContainer } from './News/NewsContainer';
import { OrganizationSwitcher } from './Organization/OrganizationSwitcher';
import { SignInLink } from './TopBar/SignInLink';
import { TopBarLayout } from './TopBar/TopBarLayout';
import { TopNavBarMenu } from './TopBar/TopNavBarMenu';
import { TopSearchBarInput } from './TopSearchBarInput';

export function TopSearchBar() {
  const styles = useStyles2(getStyles);
  const navIndex = useSelector((state) => state.navIndex);

  const helpNode = navIndex['help'];
  const profileNode = navIndex['profile'];

  return (
    <TopBarLayout>
      <TopBarLayout.TopBarWrapper>
        <a className={styles.logo} href="/" title="Go to home">
          <Icon name="grafana" size="xl" />
        </a>
        <OrganizationSwitcher />
      </TopBarLayout.TopBarWrapper>
      <TopBarLayout.TopBarWrapper>
        <TopSearchBarInput />
      </TopBarLayout.TopBarWrapper>
      <TopBarLayout.TopBarWrapper align="right">
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
      </TopBarLayout.TopBarWrapper>
    </TopBarLayout>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  logo: css({
    display: 'flex',
  }),
  profileButton: css({
    img: {
      borderRadius: '50%',
      height: '24px',
      marginRight: 0,
      width: '24px',
    },
  }),
});
