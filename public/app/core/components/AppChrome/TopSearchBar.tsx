import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, locationUtil } from '@grafana/data';
import { Dropdown, ToolbarButton, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { useSelector } from 'app/types';

import { Branding } from '../Branding/Branding';

import { NewsContainer } from './News/NewsContainer';
import { OrganizationSwitcher } from './Organization/OrganizationSwitcher';
import { QuickAdd } from './QuickAdd/QuickAdd';
import { SignInLink } from './TopBar/SignInLink';
import { TopNavBarMenu } from './TopBar/TopNavBarMenu';
import { TopSearchBarSection } from './TopBar/TopSearchBarSection';
import { TopSearchBarCommandPaletteTrigger } from './TopSearchBarCommandPaletteTrigger';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export const TopSearchBar = React.memo(function TopSearchBar() {
  const styles = useStyles2(getStyles);
  const navIndex = useSelector((state) => state.navIndex);
  const location = useLocation();

  const helpNode = navIndex['help'];
  const profileNode = navIndex['profile'];

  let homeUrl = config.appSubUrl || '/';
  if (!config.bootData.user.isSignedIn && !config.anonymousEnabled) {
    homeUrl = locationUtil.getUrlForPartial(location, { forceLogin: 'true' });
  }

  return (
    <div className={styles.layout}>
      <TopSearchBarSection>
        <a className={styles.logo} href={homeUrl} title="Go to home">
          <Branding.MenuLogo className={styles.img} />
        </a>
        <OrganizationSwitcher />
      </TopSearchBarSection>

      <TopSearchBarSection>
        <TopSearchBarCommandPaletteTrigger />
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
});

const getStyles = (theme: GrafanaTheme2) => ({
  layout: css({
    height: TOP_BAR_LEVEL_HEIGHT,
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    padding: theme.spacing(0, 1, 0, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    justifyContent: 'space-between',

    [theme.breakpoints.up('sm')]: {
      gridTemplateColumns: '1.5fr minmax(240px, 1fr) 1.5fr', // search should not be smaller than 240px
      display: 'grid',

      justifyContent: 'flex-start',
    },
  }),
  img: css({
    height: theme.spacing(3),
    width: theme.spacing(3),
  }),
  logo: css({
    display: 'flex',
  }),
  profileButton: css({
    padding: theme.spacing(0, 0.25),
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
