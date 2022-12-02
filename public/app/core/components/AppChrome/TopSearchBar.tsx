import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Icon, ToolbarButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useSelector } from 'app/types';

import { NewsContainer } from './News/NewsContainer';
import { OrganizationSwitcher } from './Organization/OrganizationSwitcher';
import { QuickAdd } from './QuickAdd/QuickAdd';
import { SignInLink } from './TopBar/SignInLink';
import { TopNavBarMenu } from './TopBar/TopNavBarMenu';
import { TopSearchBarSection } from './TopBar/TopSearchBarSection';
import { TopSearchBarInput } from './TopSearchBarInput';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export function TopSearchBar() {
  const styles = useStyles2(getStyles);
  const navIndex = useSelector((state) => state.navIndex);

  const helpNode = navIndex['help'];
  const profileNode = navIndex['profile'];

  return (
    <div className={styles.layout}>
      <TopSearchBarSection>
        <a className={styles.logo} href="/" title="Go to home">
          <Icon name="grafana" size="xl" />
        </a>
        <OrganizationSwitcher />
      </TopSearchBarSection>
      <TopSearchBarSection>
        <TopSearchBarInput />
      </TopSearchBarSection>
      <TopSearchBarSection align="right">
        <QuickAdd />
        {helpNode && (
          <Dropdown overlay={() => <TopNavBarMenu node={helpNode} />} placement="bottom-end">
            <ToolbarButton iconOnly icon="question-circle" aria-label="Help" />
          </Dropdown>
        )}
        <NewsContainer className={styles.newsButton} />
        {!contextSrv.user.isSignedIn && <SignInLink />}
        {profileNode && (
          <Dropdown overlay={() => <TopNavBarMenu node={profileNode} />} placement="bottom-end">
            <ToolbarButton
              className={styles.profileButton}
              imgSrc={contextSrv.user.gravatarUrl}
              imgAlt="User avatar"
              aria-label="Profile"
            />
          </Dropdown>
        )}
      </TopSearchBarSection>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  layout: css({
    height: TOP_BAR_LEVEL_HEIGHT,
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(0, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    justifyContent: 'space-between',

    [theme.breakpoints.up('sm')]: {
      gridTemplateColumns: '1fr 1fr 1fr',
      display: 'grid',

      justifyContent: 'flex-start',
    },
  }),
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
  newsButton: css({
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  }),
});
